// Utilidades compartidas del módulo Administrativo (solicitudes y órdenes de compra).

// Datos de la empresa que salen en el PDF de la orden de compra.
// (Mismos datos fiscales que el manifiesto de embarque.)
export const EMPRESA = {
  nombre: "AGROEXPORT DE SONORA, S.A. DE C.V.",
  rfc: "ACO100902U59",
  direccion: "Garmendia # 46 Esq. Tamaulipas, Costa de Hermosillo, Hermosillo, Sonora, México",
  telefono: "(662) 210-13-71, 214-89-11",
};

export type TipoItem = "agroquimico" | "material" | "libre";

export type LineaUI = {
  key: string;
  id?: string; // id en BD (si ya existe)
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string; // solo órdenes de compra
  tipo_item: TipoItem;
  producto_id: string | null;
  material_id: string | null;
  cantidad_recibida?: number;
};

export type ItemCatalogo = {
  nombre: string;
  unidad: string;
  tipo_item: TipoItem;
  producto_id: string | null;
  material_id: string | null;
  precio: number | null;
};

export function uid() {
  return Math.random().toString(36).slice(2);
}

export function lineaVacia(): LineaUI {
  return {
    key: uid(),
    descripcion: "",
    cantidad: "1",
    unidad: "",
    precio: "",
    tipo_item: "libre",
    producto_id: null,
    material_id: null,
  };
}

export function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Carga el catálogo unificado: agroquímicos + materiales de empaque + conceptos libres.
export async function cargarCatalogoCompras(supabase: any): Promise<ItemCatalogo[]> {
  const [{ data: agro }, { data: mats }, { data: conc }] = await Promise.all([
    supabase.from("catalogo_productos").select("id, nombre, unidad, precio_presentacion").eq("activo", true).order("nombre"),
    supabase.from("materiales_empaque").select("*").order("nombre"),
    supabase.from("adm_conceptos").select("id, nombre, unidad, precio_referencia").eq("activo", true).order("nombre"),
  ]);
  const items: ItemCatalogo[] = [];
  for (const p of (agro ?? []) as any[])
    items.push({
      nombre: p.nombre,
      unidad: p.unidad ?? "",
      tipo_item: "agroquimico",
      producto_id: p.id,
      material_id: null,
      precio: p.precio_presentacion != null ? Number(p.precio_presentacion) : null,
    });
  for (const m of (mats ?? []) as any[])
    items.push({
      nombre: m.nombre,
      unidad: m.unidad ?? "PZA",
      tipo_item: "material",
      producto_id: null,
      material_id: m.id,
      precio: null,
    });
  for (const c of (conc ?? []) as any[])
    items.push({
      nombre: c.nombre,
      unidad: c.unidad ?? "",
      tipo_item: "libre",
      producto_id: null,
      material_id: null,
      precio: c.precio_referencia != null ? Number(c.precio_referencia) : null,
    });
  return items;
}

// Busca en el catálogo el concepto que mejor coincide con un texto (nombre igual o contenido).
export function buscarEnCatalogo(texto: string, catalogo: ItemCatalogo[]): ItemCatalogo | null {
  const t = norm(texto);
  if (!t) return null;
  const exacto = catalogo.find((c) => norm(c.nombre) === t);
  if (exacto) return exacto;
  const candidatos = catalogo.filter((c) => {
    const n = norm(c.nombre);
    return n.length >= 4 && (t.includes(n) || n.includes(t));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

export function dinero(n: number, moneda = "MXN") {
  return `${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
}

export function fechaMx(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Reduce la foto (lado largo 1600 px, JPEG) para subirla rápido y que quepa en el límite de Vercel.
export async function comprimirImagen(file: File, maxLado = 1600, calidad = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo abrir la imagen"));
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir"))), "image/jpeg", calidad)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("No se pudo leer la imagen"));
    r.readAsDataURL(blob);
  });
}
