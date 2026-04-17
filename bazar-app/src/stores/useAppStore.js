import { create } from 'zustand'

function readSessionEntered() {
  try {
    return sessionStorage.getItem('bazar.sessionEntered') === '1'
  } catch {
    return false
  }
}

export const useAppStore = create((set) => ({
  section: 'inicio',
  /** Sección activa antes de abrir Configuración (para cerrar el modal y volver) */
  sectionBeforeConfig: null,
  /** Pila de secciones para el botón «atrás» (no incluye el tramo solo de Configuración). */
  navBackStack: [],
  /** Pila para «adelante» tras haber usado atrás. */
  navForwardStack: [],
  setSection: (section) =>
    set((state) => {
      if (section === state.section) return state
      if (section === 'config' && state.section !== 'config') {
        return { section: 'config', sectionBeforeConfig: state.section, navForwardStack: [] }
      }
      if (section !== 'config') {
        const from = state.section
        const push = from !== 'config'
        return {
          section,
          sectionBeforeConfig: null,
          navBackStack: push ? [...state.navBackStack, from] : state.navBackStack,
          navForwardStack: [],
        }
      }
      return { section }
    }),
  /** Vuelve a la sección anterior (historial de módulos; si estás en Config., cierra como atrás). */
  navigateBack: () =>
    set((state) => {
      if (state.section === 'config' && state.sectionBeforeConfig != null) {
        return {
          section: state.sectionBeforeConfig,
          sectionBeforeConfig: null,
          navForwardStack: ['config', ...state.navForwardStack],
        }
      }
      if (state.navBackStack.length === 0) return state
      const prev = state.navBackStack[state.navBackStack.length - 1]
      return {
        section: prev,
        sectionBeforeConfig: null,
        navBackStack: state.navBackStack.slice(0, -1),
        navForwardStack: [state.section, ...state.navForwardStack],
      }
    }),
  /** Rehace el último «atrás» (como adelante en el navegador). */
  navigateForward: () =>
    set((state) => {
      if (state.navForwardStack.length === 0) return state
      const next = state.navForwardStack[0]
      const rest = state.navForwardStack.slice(1)
      if (next === 'config') {
        return {
          section: 'config',
          sectionBeforeConfig: state.section,
          navBackStack: [...state.navBackStack, state.section],
          navForwardStack: rest,
        }
      }
      return {
        section: next,
        sectionBeforeConfig: null,
        navBackStack: [...state.navBackStack, state.section],
        navForwardStack: rest,
      }
    }),
  /** Cierra Configuración y vuelve a la pantalla previa (o Inicio). */
  closeSettings: () =>
    set((state) => ({
      section: state.sectionBeforeConfig ?? 'inicio',
      sectionBeforeConfig: null,
      navForwardStack:
        state.section === 'config' ? ['config', ...state.navForwardStack] : state.navForwardStack,
    })),
  /** Al navegar a Banqueta, abre el modal de esta salida (sidebar). */
  banquetaOpenSalidaId: null,
  requestOpenBanquetaSalida: (id) => set({ banquetaOpenSalidaId: Number(id) || null }),
  clearBanquetaOpenSalida: () => set({ banquetaOpenSalidaId: null }),
  /** Pantalla de bienvenida (Rive + deudores) hasta “Entrar al sistema”; persiste en la sesión del navegador. */
  sessionEntered: typeof window !== 'undefined' ? readSessionEntered() : false,
  enterApp: () => {
    try {
      sessionStorage.setItem('bazar.sessionEntered', '1')
    } catch {
      /* noop */
    }
    set({ sessionEntered: true })
  },
  /** Vuelve a la pantalla de bienvenida (no cierra la app). La próxima vez que abras, seguís dentro hasta cerrar sesión otra vez. */
  exitSession: () => {
    try {
      sessionStorage.removeItem('bazar.sessionEntered')
    } catch {
      /* noop */
    }
    set({
      section: 'inicio',
      sessionEntered: false,
      sectionBeforeConfig: null,
      navBackStack: [],
      navForwardStack: [],
    })
  },
}))
