export interface AddressRegion {
  id: number;
  name: string;
  province?: string;
  country?: string;
}

export interface Address {
  id: number;
  user?: number;

  region?: number | AddressRegion;
  region_name?: string;

  street: string;
  number: string;
  city: string;
  province: string;
  postal_code: string;

  reference?: string;
  is_default: boolean;
  is_active: boolean;

  created_at?: string;
  updated_at?: string;
}

export interface CreateAddressRequest {
  region: number;
  street: string;
  number: string;
  city: string;
  province: string;
  postal_code: string;
  reference?: string;
  is_default: boolean;
}