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
