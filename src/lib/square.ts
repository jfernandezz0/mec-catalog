import { SquareClient, SquareEnvironment } from 'square';
import { createHmac } from 'crypto';

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN || 'build-time-placeholder',
  environment:
    process.env.SQUARE_ENVIRONMENT === 'sandbox'
      ? SquareEnvironment.Sandbox
      : SquareEnvironment.Production,
});

export const squareLocationId = process.env.SQUARE_LOCATION_ID!;

/** Verify Square webhook HMAC-SHA256 signature */
export function verifySquareWebhookSignature(
  body: string,
  signatureHeader: string,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  const combined = notificationUrl + body;
  const hmac = createHmac('sha256', signatureKey)
    .update(combined)
    .digest('base64');
  return hmac === signatureHeader;
}

/** Create an item in Square Catalog and return its variation ID */
export async function syncArticleToSquareCatalog(article: {
  id: number;
  title: string;
  description: string | null;
  price: number | string;
  image_urls?: string[] | null;
  square_catalog_item_id?: string | null;
}) {
  const amountCents = BigInt(Math.round(Number(article.price) * 100));
  const idempotencyKey = `sync-art-${article.id}-${Date.now()}`;

  let parentItemId = `#item-${article.id}`;
  let variationId = `#var-${article.id}`;

  if (article.square_catalog_item_id) {
    try {
      const getResponse = await squareClient.catalog.object.get({
        objectId: article.square_catalog_item_id,
      });
      const existingVariation = getResponse.object;
      if (existingVariation?.type === 'ITEM_VARIATION' && existingVariation.itemVariationData?.itemId) {
        parentItemId = existingVariation.itemVariationData.itemId;
        variationId = article.square_catalog_item_id;
        console.log(`[Square Sync] Found existing item in Square: Parent=${parentItemId}, Variation=${variationId}`);
      }
    } catch (err: any) {
      console.warn(`[Square Sync] Failed to retrieve existing variation ${article.square_catalog_item_id} from Square. Will create a new one.`, err.message || err);
    }
  }

  const response = await squareClient.catalog.object.upsert({
    idempotencyKey,
    object: {
      type: 'ITEM',
      id: parentItemId,
      itemData: {
        name: article.title,
        description: article.description || undefined,
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: variationId,
            itemVariationData: {
              name: 'Único',
              pricingType: 'FIXED_PRICING',
              priceMoney: {
                amount: amountCents,
                currency: 'EUR',
              },
            },
          },
        ],
      },
    },
  });

  const catalogObject = response.catalogObject as any;
  const newVariationId = catalogObject?.itemData?.variations?.[0]?.id;
  if (!newVariationId) {
    throw new Error('Failed to retrieve item variation ID from Square response');
  }

  // Auto-sync image to Square if present, and only if the item does not already have images
  const hasImagesInSquare = catalogObject.itemData?.imageIds && catalogObject.itemData.imageIds.length > 0;
  if (article.image_urls && article.image_urls.length > 0 && catalogObject.id && !hasImagesInSquare) {
    try {
      const imageUrl = article.image_urls[0];
      const host = process.env.SQUARE_ENVIRONMENT === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

      // Download the image from Supabase Storage
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg';
        const blob = new Blob([arrayBuffer], { type: contentType });

        const formData = new FormData();
        const reqKey = `img-sync-${article.id}-${Date.now()}`;

        formData.append('request', JSON.stringify({
          idempotency_key: reqKey,
          object_id: catalogObject.id,
          image: {
            type: 'IMAGE',
            id: `#img-${article.id}`,
            image_data: {
              name: article.title
            }
          }
        }));
        
        formData.append('image', blob, `image.${contentType.split('/')[1] || 'jpg'}`);

        const squareRes = await fetch(`${host}/v2/catalog/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          },
          body: formData
        });

        if (!squareRes.ok) {
          const errMsg = await squareRes.text();
          console.error('[Square Image Sync] Failed to upload image:', errMsg);
        } else {
          console.log('[Square Image Sync] Successfully uploaded image for item', catalogObject.id);
        }
      } else {
        console.error('[Square Image Sync] Failed to download source image:', imgRes.statusText);
      }
    } catch (imgErr) {
      console.error('[Square Image Sync] Exception:', imgErr);
    }
  }

  return newVariationId;
}

