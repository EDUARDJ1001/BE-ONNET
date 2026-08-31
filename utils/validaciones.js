/**
 * Validaciones compartidas por los controladores del módulo de planillas.
 *
 * Están aquí y no repetidas en cada controlador porque el módulo tiene diez
 * endpoints que validan exactamente lo mismo: un id, una fecha y un monto.
 */

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Id entero positivo. Devuelve el número o null. */
export const aId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** 'YYYY-MM-DD'. No acepta ISO con hora: la fecha de trabajo no lleva reloj. */
export const esFecha = (valor) => typeof valor === 'string' && FECHA_REGEX.test(valor);

/** Monto numérico >= 0. Un jornal puede ser 0 (vino y no se le pagó ese día). */
export const aMonto = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Monto estrictamente positivo: un gasto o un pago de 0 no tiene sentido. */
export const aMontoPositivo = (valor) => {
  const n = aMonto(valor);
  return n !== null && n > 0 ? n : null;
};

/** Entero >= 0 (cantidad de instalaciones, metros...). */
export const aCantidad = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Traduce errores de MySQL a respuestas útiles.
 * Sin esto, un alias repetido o un FK roto llegan al frontend como un 500
 * genérico y toca leer los logs del servidor para saber qué pasó.
 */
export const responderErrorSql = (res, err, mensajeGenerico) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos', detalle: err.sqlMessage });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Alguna referencia no existe (proyecto, colaborador, categoría...)' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'No se puede eliminar: tiene registros asociados' });
  }
  console.error(mensajeGenerico, err);
  return res.status(500).json({ error: mensajeGenerico });
};
