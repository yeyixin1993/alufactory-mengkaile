export type CanonicalMembershipLevel = 'standard' | 'vip' | 'vip_plus';

export const normalizeMembershipLevel = (value: unknown): CanonicalMembershipLevel => {
  const raw = String(value ?? '').trim().toLowerCase();

  if (!raw) return 'standard';

  // VIP+ aliases
  if (
    raw === 'vip_plus' ||
    raw === 'vip+' ||
    raw === 'vip plus' ||
    raw === 'vipp' ||
    raw === 'vplus' ||
    raw === '高级vip' ||
    raw === '会员plus'
  ) {
    return 'vip_plus';
  }

  // VIP aliases
  if (
    raw === 'vip' ||
    raw === '会员vip' ||
    raw === '会员'
  ) {
    return 'vip';
  }

  return 'standard';
};

export const isVipMembership = (value: unknown): boolean => {
  const level = normalizeMembershipLevel(value);
  return level === 'vip' || level === 'vip_plus';
};

export const getAccessoryShippingWeightKg = (
  user: { membershipLevel?: unknown } | null | undefined,
  hasAccessory: boolean,
  accessorySubtotal: number,
): number => {
  if (!hasAccessory) return 0;

  // VIP+ free accessory freight is an account entitlement. A guest (or any
  // user without an explicit VIP+ status) must continue through the normal
  // accessory threshold instead of inheriting the zero-weight branch.
  if (user && normalizeMembershipLevel(user.membershipLevel) === 'vip_plus') return 0;

  return accessorySubtotal < 30 ? 1 : 0;
};
