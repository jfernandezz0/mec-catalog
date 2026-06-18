export interface Category {
  id: number;
  name: string;
  country_code: string;
  is_visible?: boolean;
  discount_percent?: number | null;
  articles?: Array<{ count: number }>;
}

export interface Article {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
  frame_image_urls?: string[] | null;
  sort_order?: number;
  contact_clicks?: number;
  share_clicks?: number;
  views?: number;
  discount_type?: string | null;
  discount_value?: number | null;
}
