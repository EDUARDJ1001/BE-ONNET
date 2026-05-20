import connectDB from '../config/db.js';

export const ESTADOS_INTERVENCION = ['Borrador', 'Finalizada', 'Facturada', 'Anulada'];

let tipoServicioDisplayColumn = null;
let tipoServicioColumnResolved = false;

const parseDetalleBitacora = (value) => {
  if (value === null || value === undefined || value === '') return [];

  if (Array.isArray(value)) return value;

  if (Buffer.isBuffer(value)) {
    try {
      const parsed = JSON.parse(value.toString('utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return Array.isArray(value) ? value : [];
  }

  return [];
};

const normalizarIntervencion = (row) => {
  if (!row) return null;

  return {
    ...row,
    detalle_bitacora: parseDetalleBitacora(row.detalle_bitacora),
    total_estimado: Number(row.total_estimado ?? 0),
  };
};

const resolverColumnaDisplayTipoServicio = async (connection) => {
  if (tipoServicioColumnResolved) return tipoServicioDisplayColumn;

  tipoServicioColumnResolved = true;

  try {
    const [rows] = await connection.query(
      `
      SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tipoServicio'
       ORDER BY ORDINAL_POSITION
      `
    );

    const columnas = rows.map((r) => r.COLUMN_NAME);
    const preferidas = ['nombre', 'descripcion', 'tipo', 'servicio', 'detalle'];

    let elegida = preferidas.find((c) => columnas.includes(c));
    if (!elegida) {
      elegida = columnas.find((c) => c !== 'id') || null;
    }

    if (elegida && /^[A-Za-z_][A-Za-z0-9_]*$/.test(elegida)) {
      tipoServicioDisplayColumn = elegida;
    }
  } catch (_e) {
    tipoServicioDisplayColumn = null;
  }

  return tipoServicioDisplayColumn;
};

const construirSelectBase = async (connection) => {
  const displayColumn = await resolverColumnaDisplayTipoServicio(connection);
  const tipoServicioSelect = displayColumn
    ? `ts.\`${displayColumn}\` AS tipo_servicio_nombre`
    : `CAST(it.tipo_servicio_id AS CHAR) AS tipo_servicio_nombre`;

  return `
    SELECT
      it.*,
      c.nombre AS cliente_nombre,
      CONCAT_WS(' ', u.nombre, u.apellido) AS usuario_nombre,
      ${tipoServicioSelect}
    FROM intervenciones_tecnicas it
    LEFT JOIN clientes c ON it.cliente_id = c.id
    LEFT JOIN usuarios u ON it.usuario_id = u.id
    LEFT JOIN tipoServicio ts ON it.tipo_servicio_id = ts.id
  `;
};

export const obtenerIntervencionesTecnicas = async () => {
  const connection = await connectDB();
  const baseSelect = await construirSelectBase(connection);
  const [rows] = await connection.query(
    `${baseSelect}
     ORDER BY it.fecha DESC, it.id DESC`
  );

  return rows.map(normalizarIntervencion);
};

export const obtenerIntervencionTecnicaPorId = async (id) => {
  const connection = await connectDB();
  const baseSelect = await construirSelectBase(connection);
  const [rows] = await connection.query(
    `${baseSelect}
     WHERE it.id = ?
     LIMIT 1`,
    [id]
  );

  return normalizarIntervencion(rows[0] || null);
};

export const obtenerIntervencionesTecnicasPorCliente = async (clienteId) => {
  const connection = await connectDB();
  const baseSelect = await construirSelectBase(connection);
  const [rows] = await connection.query(
    `${baseSelect}
     WHERE it.cliente_id = ?
     ORDER BY it.fecha DESC, it.id DESC`,
    [clienteId]
  );

  return rows.map(normalizarIntervencion);
};

export const crearIntervencionTecnica = async (data) => {
  const connection = await connectDB();
  const detalleBitacora =
    data.detalle_bitacora === null || data.detalle_bitacora === undefined
      ? null
      : JSON.stringify(data.detalle_bitacora);

  const [result] = await connection.query(
    `
    INSERT INTO intervenciones_tecnicas (
      cliente_id,
      usuario_id,
      tipo_servicio_id,
      descripcion,
      fecha,
      observacion,
      detalle_bitacora,
      total_estimado,
      estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.cliente_id,
      data.usuario_id,
      data.tipo_servicio_id,
      data.descripcion ?? null,
      data.fecha,
      data.observacion ?? null,
      detalleBitacora,
      data.total_estimado,
      data.estado,
    ]
  );

  return obtenerIntervencionTecnicaPorId(result.insertId);
};

export const actualizarIntervencionTecnica = async (id, data) => {
  const connection = await connectDB();
  const detalleBitacora =
    data.detalle_bitacora === null || data.detalle_bitacora === undefined
      ? null
      : JSON.stringify(data.detalle_bitacora);

  const [result] = await connection.query(
    `
    UPDATE intervenciones_tecnicas
       SET cliente_id = ?,
           usuario_id = ?,
           tipo_servicio_id = ?,
           descripcion = ?,
           fecha = ?,
           observacion = ?,
           detalle_bitacora = ?,
           total_estimado = ?,
           estado = ?
     WHERE id = ?
    `,
    [
      data.cliente_id,
      data.usuario_id,
      data.tipo_servicio_id,
      data.descripcion ?? null,
      data.fecha,
      data.observacion ?? null,
      detalleBitacora,
      data.total_estimado,
      data.estado,
      id,
    ]
  );

  if (result.affectedRows === 0) return null;

  return obtenerIntervencionTecnicaPorId(id);
};

export const cambiarEstadoIntervencionTecnica = async (id, estado) => {
  const connection = await connectDB();

  const [result] = await connection.query(
    `
    UPDATE intervenciones_tecnicas
       SET estado = ?
     WHERE id = ?
    `,
    [estado, id]
  );

  if (result.affectedRows === 0) return null;

  return obtenerIntervencionTecnicaPorId(id);
};

export const anularIntervencionTecnica = async (id) => {
  return cambiarEstadoIntervencionTecnica(id, 'Anulada');
};

