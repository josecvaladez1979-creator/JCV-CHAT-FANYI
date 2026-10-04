export interface PlanDefinition {
  id: string;
  nombre: string;
  precio: number;
  traducciones_incluidas: number;
  chat_nativo: string;
  llamadas_voz: string;
  videollamadas: string;
  audio: string;
  vigencia: string;
}

export const PLAN_FREEMIUM: PlanDefinition;
export function getPlan(): PlanDefinition;
export function tienePackPagado(): boolean;
export function traducirMensaje<T>(mensaje: T, traducirConSiliconFlow?: (m: T) => any): any;

declare global {
  interface Window {
    PLAN_FREEMIUM: PlanDefinition;
    getPlan: () => PlanDefinition;
    tienePackPagado: () => boolean;
    traducirMensaje: (mensaje: any, fn?: any) => any;
    traduccionActiva?: boolean;
  }
}
