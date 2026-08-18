import { api } from "../lib/api";
import { extractResults } from "../types/api";
import type { ListResponse } from "../types/api";
import type {
  Address,
  CreateAddressRequest,
} from "../types/address";

const ADDRESS_ENDPOINT = "/addresses/";

export async function getAddresses(): Promise<Address[]> {
  const response = await api.get<ListResponse<Address>>(
    ADDRESS_ENDPOINT
  );

  return extractResults(response.data);
}

export async function createAddress(
  data: CreateAddressRequest
): Promise<Address> {
  const response = await api.post<Address>(
    ADDRESS_ENDPOINT,
    data
  );

  return response.data;
}

export async function updateAddress(
  addressId: number,
  data: Partial<CreateAddressRequest>
): Promise<Address> {
  const response = await api.patch<Address>(
    `${ADDRESS_ENDPOINT}${addressId}/`,
    data
  );

  return response.data;
}

export async function deleteAddress(
  addressId: number
): Promise<void> {
  await api.delete(`${ADDRESS_ENDPOINT}${addressId}/`);
}