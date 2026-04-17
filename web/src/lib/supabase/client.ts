import { LOCAL_ACCESS_TOKEN, LOCAL_USER_EMAIL, LOCAL_USER_ID } from '@/lib/local-user'

export function createClient() {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              access_token: LOCAL_ACCESS_TOKEN,
              user: {
                id: LOCAL_USER_ID,
                email: LOCAL_USER_EMAIL,
              },
            },
          },
        }
      },
      async signOut() {
        return { error: null }
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        }
      },
    },
  }
}
