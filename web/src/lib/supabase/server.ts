import { createClient as createBrowserClient } from './client'

export async function createServerClient() {
  return createBrowserClient()
}

export async function createClientForServer() {
  return createBrowserClient()
}

export async function createClient() {
  return createServerClient()
}
