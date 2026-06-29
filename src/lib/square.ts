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
}) {
  const amountCents = BigInt(Math.round(Number(article.price) * 100));
  const idempotencyKey = `sync-art-${article.id}-${Date.now()}`;

  const response = await squareClient.catalog.object.upsert({
    idempotencyKey,
    object: {
      type: 'ITEM',
      id: `#item-${article.id}`,
      itemData: {
        name: article.title,
        description: article.description || undefined,
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: `#var-${article.id}`,
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
  const variationId = catalogObject?.itemData?.variations?.[0]?.id;
  if (!variationId) {
    throw new Error('Failed to retrieve item variation ID from Square response');
  }

  return variationId;
}

