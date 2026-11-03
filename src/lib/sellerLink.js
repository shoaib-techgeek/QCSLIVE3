/** Where the "sell" call to action goes: approved sellers open their center, everyone else starts or continues onboarding. */
export function sellerLinkFor(account) {
  return account?.permissions?.includes('seller:access')
    ? { to: '/seller', label: 'Seller center' }
    : { to: '/seller/onboarding', label: 'Sell on QCS Store' }
}
