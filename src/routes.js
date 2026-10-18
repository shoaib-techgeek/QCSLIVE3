/** Default landing route for a signed-in user. */
export const homeFor = (user) => (user.role === 'admin' ? '/admin' : '/portal')
