// Mapa de sinónimos → categoría canónica. Fuente ÚNICA para todos los flujos
// de alta/actualización (uno por uno, batch, reindex y el agente), para que las
// categorías no se fragmenten (ej: "Personas Desaparecidas" vs "Desaparecidos").
// La clave va en minúscula; el analizador compara con toLowerCase().
export const CANON = {
  // desaparecidos
  'personas desaparecidas': 'Desaparecidos',
  'personas perdidas': 'Desaparecidos',
  // mapas
  'mapas de ayuda': 'Mapas',
  'mapas de daños': 'Mapas',
  mapa: 'Mapas',
  // edificaciones
  'edificaciones dañadas': 'Edificaciones',
  'daños estructurales': 'Edificaciones',
  // directorio
  'recursos directorio': 'Directorio',
  'directorio de recursos': 'Directorio',
  // refugios
  refugio: 'Refugios',
  // donaciones / acopio
  donación: 'Donaciones',
  'centros de acopio': 'Donaciones',
  acopio: 'Donaciones',
  // salud
  hospitales: 'Salud',
  'salud mental': 'Salud',
}
