export type Role = 'admin' | 'manager' | 'supervisor' | 'officer';
export type CollectionStatus = 'Collected' | 'Not Collected';

export interface PublicPassport {
  arn: string;
  fullName: string;
  passportNumber?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  arrivalDate?: string | null;
  publicStatus: CollectionStatus;
  collectedAt?: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  siteId: string | null;
  siteCode?: string | null;
  siteName?: string | null;
}
