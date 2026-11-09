import { ehAdmin } from '../../app/src/admin/acesso.js'

test('só role admin entra', () => {
  expect(ehAdmin({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  expect(ehAdmin({ user: { app_metadata: {} } })).toBe(false)
  expect(ehAdmin(null)).toBe(false)
})
