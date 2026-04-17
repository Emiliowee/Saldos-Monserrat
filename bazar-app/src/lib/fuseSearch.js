import Fuse from 'fuse.js'

export function createProductFuse(products, keys = ['codigo', 'descripcion']) {
  return new Fuse(products, {
    keys,
    threshold: 0.35,
    ignoreLocation: true,
  })
}
