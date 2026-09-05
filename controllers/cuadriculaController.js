import { obtenerCuadricula, guardarCuadricula } from '../models/cuadriculaModel.js';
import { aId, aMonto, aCantidad, esFecha, responderErrorSql } from '../utils/validaciones.js';

const ESTADOS_DIA = ['trabajado', 'no_trabajado', 'descanso', 'feriado'];

export const obtenerCuadriculaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const cuadricula = await obtenerCuadricula(id);
    if (!cuadricula) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json(cuadricula);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener la cuadrícula');
  }
};

/**
 * Valida las filas que llegan de la cuadrícula.
 *
 * Se valida TODO antes de tocar la base: si la fila 12 trae un monto inválido,
 * no tiene sentido haber guardado ya las once anteriores.
 */
const validar = (dias, planilla) => {
  if (!Array.isArray(dias)) return 'Se espera un arreglo "dias"';
  if (dias.length === 0) return 'No hay nada que guardar';

  const fechas = new Set();

  for (const dia of dias) {
    if (!esFecha(dia.fecha)) return `Fecha inválida: ${dia.fecha}`;
    if (fechas.has(dia.fecha)) return `La fecha ${dia.fecha} viene repetida`;
    fechas.add(dia.fecha);

    if (planilla && (dia.fecha < planilla.fecha_inicio || dia.fecha > planilla.fecha_fin)) {
      return `La fecha ${dia.fecha} está fuera del periodo de la planilla`;
    }

    if (dia.estado && !ESTADOS_DIA.includes(dia.estado)) {
      return `Estado inválido en ${dia.fecha}. Use: ${ESTADOS_DIA.join(', ')}`;
    }

    for (const campo of ['tarifa_instalacion', 'metros_fibra', 'punta_inicial',
                         'punta_final', 'tarifa_metro', 'bono_onnet', 'ingreso']) {
      if (dia[campo] !== undefined && aMonto(dia[campo]) === null) {
        return `${campo} en ${dia.fecha} debe ser un número mayor o igual a 0`;
      }
    }

    if (dia.instalaciones !== undefined && aCantidad(dia.instalaciones) === null) {
      return `instalaciones en ${dia.fecha} debe ser un número mayor o igual a 0`;
    }

    if (dia.pagos !== undefined) {
      if (!Array.isArray(dia.pagos)) return `"pagos" de ${dia.fecha} debe ser un arreglo`;

      const vistos = new Set();
      for (const p of dia.pagos) {
        if (!aId(p.colaborador_id)) return `colaborador_id inválido en ${dia.fecha}`;
        if (vistos.has(p.colaborador_id)) {
          return `El colaborador ${p.colaborador_id} viene dos veces en ${dia.fecha}`;
        }
        vistos.add(p.colaborador_id);

        // El jornal admite 0: se fue a trabajar y no cobró ese día. Lo que no
        // admite es negativo, que en el Excel aparecía y no significa nada
        // representable aquí.
        if (p.monto !== undefined && aMonto(p.monto) === null) {
          return `Monto inválido para el colaborador ${p.colaborador_id} en ${dia.fecha}`;
        }
        if (p.bono !== undefined && aMonto(p.bono) === null) {
          return `Bono inválido para el colaborador ${p.colaborador_id} en ${dia.fecha}`;
        }
      }
    }

    if (dia.gastos !== undefined) {
      if (!Array.isArray(dia.gastos)) return `"gastos" de ${dia.fecha} debe ser un arreglo`;
      for (const g of dia.gastos) {
        if (!aId(g.categoria_id)) return `Categoría de gasto inválida en ${dia.fecha}`;
        if (aMonto(g.monto) === null) return `Monto de gasto inválido en ${dia.fecha}`;
      }
    }
  }

  return null;
};

/** Normaliza una fila antes de mandarla al modelo. */
const normalizar = (dia) => {
  const salida = { fecha: dia.fecha };

  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  if (dia.sector !== undefined) salida.sector = texto(dia.sector);
  if (dia.trabajo_realizado !== undefined) salida.trabajo_realizado = texto(dia.trabajo_realizado);
  if (dia.observaciones !== undefined) salida.observaciones = texto(dia.observaciones);
  if (dia.estado !== undefined) salida.estado = dia.estado;
  if (dia.proyecto_id !== undefined) salida.proyecto_id = dia.proyecto_id ? aId(dia.proyecto_id) : null;
  if (dia.tipo_fibra_id !== undefined) salida.tipo_fibra_id = dia.tipo_fibra_id ? aId(dia.tipo_fibra_id) : null;
  if (dia.instalaciones !== undefined) salida.instalaciones = aCantidad(dia.instalaciones);

  for (const campo of ['tarifa_instalacion', 'metros_fibra', 'punta_inicial',
                       'punta_final', 'tarifa_metro', 'bono_onnet', 'ingreso']) {
    if (dia[campo] !== undefined) salida[campo] = aMonto(dia[campo]) ?? 0;
  }

  if (dia.pagos !== undefined) {
    salida.pagos = dia.pagos.map((p) => ({
      colaborador_id: aId(p.colaborador_id),
      asistio: p.asistio,
      monto: aMonto(p.monto) ?? 0,
      bono: aMonto(p.bono) ?? 0,
      observacion: texto(p.observacion)
    }));
  }

  if (dia.gastos !== undefined) {
    salida.gastos = dia.gastos.map((g) => ({
      categoria_id: aId(g.categoria_id),
      descripcion: texto(g.descripcion),
      monto: aMonto(g.monto) ?? 0,
      fecha: g.fecha || dia.fecha
    }));
  }

  return salida;
};

export const guardarCuadriculaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const actual = await obtenerCuadricula(id);
    if (!actual) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }

    const error = validar(req.body.dias, actual.planilla);
    if (error) {
      return res.status(400).json({ error });
    }

    const resultado = await guardarCuadricula(
      id,
      req.body.dias.map(normalizar),
      req.usuario?.id ?? null
    );

    // Se devuelve la cuadrícula recargada para que la pantalla muestre los
    // totales que calculó la base, no los que estimó el navegador.
    const cuadricula = await obtenerCuadricula(id);
    res.json({ ...resultado, cuadricula });
  } catch (err) {
    if (err.codigo === 'PLANILLA_PAGADA') {
      return res.status(409).json({ error: err.message });
    }
    responderErrorSql(res, err, 'Error al guardar la cuadrícula');
  }
};
