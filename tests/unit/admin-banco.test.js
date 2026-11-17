import { resumoDoBanco } from '../../app/src/admin/bancoResumo.js'

test('resumoDoBanco conta o total e as que servem', () => {
  expect(resumoDoBanco([{ serve: true }, { serve: false }, { serve: true }, { serve: null }])).toEqual({ total: 4, servem: 2 })
})
test('resumoDoBanco aceita lista vazia', () => {
  expect(resumoDoBanco([])).toEqual({ total: 0, servem: 0 })
  expect(resumoDoBanco(undefined)).toEqual({ total: 0, servem: 0 })
})
