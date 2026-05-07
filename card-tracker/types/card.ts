export type Sport = 'Baseball' | 'Basketball' | 'Football' | 'Hockey' | 'Soccer' | 'Other'
export type Strategy = 'flip' | 'grade'
export type CardStatus = 'owned' | 'at_grader' | 'graded' | 'sold' | 'collection'
export type Source = 'Card Show' | 'eBay' | 'LCS' | 'Private' | 'Online' | 'Other'
export type SalePlatform = 'eBay' | 'PWCC' | 'Whatnot' | 'Private' | 'Instagram' | 'Facebook' | 'Other'

export interface Card {
  id: string
  player: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variant: string | null
  sport: Sport
  purchase_price: number
  purchase_fees: number
  purchase_date: string
  source: Source | null
  strategy: Strategy
  status: CardStatus
  submitted_date: string | null
  returned_date: string | null
  psa_grade: string | null
  sale_price: number | null
  sale_fees: number | null
  sale_shipping: number | null
  platform: SalePlatform | null
  sold_date: string | null
  notes: string | null
  batch_name: string | null
  created_at: string
  updated_at: string
}

export interface Settings {
  id: number
  psa_cost: number
  updated_at: string
}

export interface SellFormData {
  sale_price: string
  platform: SalePlatform | ''
  sale_fees: string
  sale_shipping: string
  sold_date: string
}

export interface GradeFormData {
  psa_grade: string
  returned_date: string
}
