/** Altura de scroll del inicio (en pantallas) por cada parada del recorrido 3D. */
export const SCROLL_VH_PER_STOP = 60;
/** Fracción de pantalla de scroll dentro de la cual el showroom 3D sigue siendo interactivo. */
export const INTERACTIVE_VH = 0.12;
/** La coreografía termina cuando la colección ya asoma: fracción de pantalla que se descuenta del tramo. */
export const CHOREOGRAPHY_TAIL_VH = 0.55;
/** Con la escena 3D a la vista (hasta esta fracción de pantalla antes del final del recorrido) la cámara vuela hasta la prenda al abrirla. */
export const CAMERA_FLIGHT_MAX_VH = 0.6;
/** Un nuevo foco debe sostenerse este tiempo antes de confirmarse (evita parpadeos por la inercia del dedo). */
export const FOCUS_CONFIRM_MS = 120;
export const FOCUS_RECHECK_MS = 140;
/** Margen bajo la barra superior al desplazarse a un bloque del inicio. */
export const SCROLL_OFFSET = -96;
/** Valor de `state.scrollFocus` que obliga a reaplicar el foco al volver del producto. */
export const FOCUS_REAPPLY = -2;
