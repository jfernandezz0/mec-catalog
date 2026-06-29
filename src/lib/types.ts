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

export interface Sale {
  id: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_instagram: string | null;
  location: string;
  payment_type: 'BIZUM' | 'PAYPAL' | 'EFECTIVO' | 'RESERVA' | 'SQUARE';
  total_price: number;
  total_articles: number;
  status: 'COMPLETADA' | 'PRECOMPRA' | 'CANCELADA';
  created_at: string;
  // New payment integration fields
  square_payment_id?: string | null;
  square_order_id?: string | null;
  buyer_name?: string | null;
  shipping_address?: object | null;
  shipping_status?: string | null;
  tracking_link?: string | null;
  order_number?: string | null;
  receipt_email?: string | null;
  receipt_whatsapp?: string | null;
  whatsapp_sent?: boolean;
  receipt_sent_at?: string | null;
}

export interface SaleItem {
  id: number;
  sale_id: string;
  article_id: number | null;
  title: string;
  quantity: number;
  price: number;
  is_prepurchase: boolean;
}

export interface StatsSnapshot {
  id: number;
  period_name: string;
  total_views: number;
  total_contact_clicks: number;
  total_share_clicks: number;
  article_count: number;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export type ImportRow = {
  rowIndex: number;
  categoria: string;
  marca: string;
  modelo: string;
  precio: string;
  cantidad: string;
  descripcion: string;
  errors: string[];
  categoryId: number | null;
};

export type FormState = {
  categoryId: string;
  marca: string;
  modelo: string;
  description: string;
  price: string;
  quantity: string;
  discountType: string;
  discountValue: string;
};

export const initialFormState: FormState = {
  categoryId: '',
  marca: '',
  modelo: '',
  description: '',
  price: '',
  quantity: '1',
  discountType: '',
  discountValue: '',
};

export type AdminTab = 'catalog' | 'create' | 'edit' | 'categories' | 'import' | 'config' | 'sales' | 'sales-create' | 'analytics' | 'generate_list';

// Cart types
export interface CartItem {
  article: Article;
  priceAtAdd: number; // final price at the moment of adding to cart
}

export interface CartStockStatus {
  articleId: number;
  available: boolean; // true = in stock (quantity=1), false = sold or reserved
}
