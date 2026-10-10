"use strict";
/* =========================================================
TOPocalc - POLIGONAL CERRADA
Compatible con el HTML original de POLC.html
========================================================= */
/* ===================== ESTADO DE LA APLICACIÓN ===================== */

let proyectos = [];
let proyectoActualId = null;
let modoEdicion = false;
let ultimoResultado = null;
let usuarioActual = null;
/* ===================== ELEMENTOS ===================== */
const $ = (id) => document.getElementById(id);
const panelProyectos = $("panelProyectos");
const panelFormulario = $("panelFormulario");
const panelResultados = $("panelResultados");
const listaProyectos = $("listaProyectos");
const mensajeVacio = $("mensajeVacio");
const contadorProyectos = $("contadorProyectos");
const formProyecto = $("formProyecto");
const cuerpoObservaciones = $("cuerpoObservaciones");
const cuerpoResultados = $("cuerpoResultados");
const resumenCalculo = $("resumenCalculo");
const mensaje = $("mensaje");
/* ===================== UTILIDADES ===================== */
function numero(valor) {
if (typeof valor === "number") return valor;
const texto = String(valor ?? "").trim().replace(",", ".");
if (texto === "") return NaN;
return Number(texto);
}
function formato(valor, decimales = 4) {
if (!Number.isFinite(valor)) return "—";
return valor.toLocaleString("es-CO", {
minimumFractionDigits: decimales,
maximumFractionDigits: decimales
});
}
function normalizarAzimut(azimut) {
return ((azimut % 360) + 360) % 360;
}
function radianes(grados) {
return grados * Math.PI / 180;
}
function gradosDesdeRadianes(radianesValor) {
return radianesValor * 180 / Math.PI;
}
function generarId() {
return "POL-" + Date.now() + "-" +
Math.random().toString(36).slice(2, 8);
}
function mostrarMensaje(texto, tipo = "error") {
if (!mensaje) return;
mensaje.textContent = texto;
mensaje.className = `mensaje ${tipo}`;
mensaje.classList.remove("oculto");
mensaje.scrollIntoView({
behavior: "smooth",
block: "center"
});
}
function ocultarMensaje() {
if (!mensaje) return;
mensaje.textContent = "";
mensaje.className = "mensaje oculto";
}
function mostrarPanel(panel) {
[panelProyectos, panelFormulario, panelResultados]
.forEach(elemento => elemento?.classList.add("oculto"));
panel?.classList.remove("oculto");
}
function escaparHTML(valor) {
return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
"&": "&amp;",
"<": "&lt;",
">": "&gt;",
'"': "&quot;",
"'": "&#39;"
})[caracter]);
}
/* ===================== ALMACENAMIENTO EN SUPABASE ===================== */

async function cargarProyectos() {
    if (!usuarioActual) {
        proyectos = [];
        return;
    }

    const { data, error } = await clienteSupabase
        .from("proyectos")
        .select("id, nombre, tipo, datos, creado_en, actualizado_en")
        .eq("usuario_id", usuarioActual.id)
        .eq("tipo", "poligonal_cerrada")
        .order("actualizado_en", { ascending: false });

    if (error) {
        console.error("No se pudieron cargar los proyectos:", error);
        throw error;
    }

    proyectos = (data || []).map(registro => ({
        ...(registro.datos || {}),
        id: registro.id,
        nombre: registro.nombre
    }));
}
/* ===================== ÁNGULOS ===================== */
/*
Los ángulos se almacenan en grados decimales para calcular,
pero se muestran en grados, minutos y segundos.
*/
function dmsAGrados(grados, minutos, segundos) {
const g = numero(grados);
const m = numero(minutos);
const s = numero(segundos);
if (![g, m, s].every(Number.isFinite)) {
throw new Error("Completa todos los campos del ángulo.");
}
if (m < 0 || m >= 60 || s < 0 || s >= 60) {
throw new Error(
"Los minutos y segundos deben estar entre 0 y menos de 60."
);
}
if (g < 0) {
throw new Error(
"Ingresa los grados como un valor positivo."
);
}
return g + m / 60 + s / 3600;
}
function leerAngulo(fila) {
return dmsAGrados(
fila.querySelector(".grados")?.value,
fila.querySelector(".minutos")?.value,
fila.querySelector(".segundos")?.value
);
}
function gradosADMS(grados) {
let valor = Math.abs(grados);
let g = Math.floor(valor);
let minutosCompletos = (valor - g) * 60;
let m = Math.floor(minutosCompletos);
let s = (minutosCompletos - m) * 60;
s = Math.round(s * 10000) / 10000;
if (s >= 60) {
s = 0;
m++;
}
if (m >= 60) {
m = 0;
g++;
}
return {
grados: g,
minutos: m,
segundos: s,
texto: `${g}° ${String(m).padStart(2, "0")}' ${
formato(s, 0)
}"`
};
}
/* ===================== AZIMUT ===================== */
/*
Convención:
Norte = 0°
Este  = 90°
Sur   = 180°
Oeste = 270°
atan2(ΔEste, ΔNorte) permite calcular el azimut desde
las coordenadas de la armada hasta las del amarre.
*/
function calcularAzimut(norteInicial, esteInicial,
norteFinal, esteFinal) {
const deltaNorte = norteFinal - norteInicial;
const deltaEste = esteFinal - esteInicial;
if (Math.hypot(deltaNorte, deltaEste) === 0) {
throw new Error(
"La armada y el amarre no pueden tener las mismas coordenadas."
);
}
return normalizarAzimut(
gradosDesdeRadianes(
Math.atan2(deltaEste, deltaNorte)
)
);
}
function calcularDistancia(n1, e1, n2, e2) {
return Math.hypot(n2 - n1, e2 - e1);
}
function actualizarOrientacion() {
const campos = [
$("norteReferencia"),
$("esteReferencia"),
$("norteAmarre"),
$("esteAmarre")
];
if (campos.some(campo =>
!campo || campo.value.trim() === ""
)) {
return;
}
const [n1, e1, n2, e2] = campos.map(
campo => numero(campo.value)
);
if (![n1, e1, n2, e2].every(Number.isFinite)) {
return;
}
try {
const azimut = calcularAzimut(n1, e1, n2, e2);
// El HTML original no incluye un campo específico de azimut.
// Se informa mediante el mensaje existente.
if ($("mensaje")) {
mensaje.textContent =
`Azimut armada → amarre: ${formato(azimut, 4)}° | ` +
`Distancia: ${formato(calcularDistancia(n1, e1, n2, e2), 4)} m`;
mensaje.className = "mensaje exito";
mensaje.classList.remove("oculto");
}
} catch (error) {
// No interrumpir la edición mientras se escriben los datos.
}
}
/* ===================== TABLA DE OBSERVACIONES ===================== */
function crearCampoDMS(clase, valor = "") {
return `
<input
type="number"
class="${clase}"
min="0"
step="any"
value="${escaparHTML(valor)}"
required
aria-label="${clase}"
>
`;
}
function crearFilaObservacion(tipo, estacion, punto, distancia = "") {
const fila = document.createElement("tr");
fila.dataset.tipo = tipo;
if (tipo === "orientacion") {
fila.innerHTML = `
<td>Orientación</td>
<td>${escaparHTML(estacion)}</td>
<td>${escaparHTML(punto)}</td>
<td>${crearCampoDMS("grados")}</td>
<td>${crearCampoDMS("minutos")}</td>
<td>${crearCampoDMS("segundos")}</td>
<td>
<input
type="number"
class="distancia"
min="0.000001"
step="any"
placeholder="Distancia"
required
aria-label="Distancia armada a P1"
>
</td>
`;
} else {
const esUltimoVertice = punto === "P1";
fila.innerHTML = `
<td>Vértice</td>
<td>${escaparHTML(estacion)}</td>
<td>${escaparHTML(punto)}</td>
<td>${crearCampoDMS("grados")}</td>
<td>${crearCampoDMS("minutos")}</td>
<td>${crearCampoDMS("segundos")}</td>
<td>
<input
type="number"
class="distancia"
min="0.000001"
step="any"
placeholder="${esUltimoVertice ? "Cierre calculado" : "Distancia"}"
${esUltimoVertice ? "disabled" : "required"}
aria-label="Distancia al siguiente punto"
value="${esUltimoVertice ? "" : escaparHTML(distancia)}"
>
</td>
`;
}
return fila;
}
function generarObservaciones(cantidad, datosGuardados = null) {
cuerpoObservaciones.innerHTML = "";
const estacion = $("estacionReferencia").value.trim() || "ARMADA";
const amarre = $("puntoAmarre").value.trim() || "AMARRE";
// La orientación inicial se mantiene separada de los ángulos
// de los vértices y no se suma al cierre angular.
const filaOrientacion = crearFilaObservacion(
"orientacion",
estacion,
"P1"
);
cuerpoObservaciones.appendChild(filaOrientacion);
for (let i = 0; i < cantidad; i++) {
const nombreEstacion = `P${i + 1}`;
const nombrePunto = i === cantidad - 1
? "P1"
: `P${i + 2}`;
const observacionGuardada =
datosGuardados?.observaciones?.[i];
const fila = crearFilaObservacion(
"vertice",
nombreEstacion,
nombrePunto,
observacionGuardada?.distancia ?? ""
);
if (observacionGuardada) {
fila.querySelector(".grados").value =
observacionGuardada.grados ?? "";
fila.querySelector(".minutos").value =
observacionGuardada.minutos ?? "";
fila.querySelector(".segundos").value =
observacionGuardada.segundos ?? "";
}
cuerpoObservaciones.appendChild(fila);
}
if (datosGuardados?.orientacion) {
const fila = filaOrientacion;
fila.querySelector(".grados").value =
datosGuardados.orientacion.grados ?? "";
fila.querySelector(".minutos").value =
datosGuardados.orientacion.minutos ?? "";
fila.querySelector(".segundos").value =
datosGuardados.orientacion.segundos ?? "";
fila.querySelector(".distancia").value =
datosGuardados.orientacion.distancia ?? "";
}
}
function leerObservaciones() {
const filas = [
...cuerpoObservaciones.querySelectorAll("tr")
];
const filaOrientacion = filas.find(
fila => fila.dataset.tipo === "orientacion"
);
const filasVertices = filas.filter(
fila => fila.dataset.tipo === "vertice"
);
if (!filaOrientacion || filasVertices.length < 3) {
throw new Error(
"Genera al menos tres vértices y una orientación inicial."
);
}
const orientacion = {
grados: filaOrientacion.querySelector(".grados").value,
minutos: filaOrientacion.querySelector(".minutos").value,
segundos: filaOrientacion.querySelector(".segundos").value,
distancia: numero(
filaOrientacion.querySelector(".distancia").value
)
};
orientacion.angulo = dmsAGrados(
orientacion.grados,
orientacion.minutos,
orientacion.segundos
);
if (!(orientacion.distancia > 0)) {
throw new Error(
"La distancia desde la armada hasta P1 debe ser mayor que cero."
);
}
const observaciones = filasVertices.map((fila, indice) => {
const distancia = numero(
fila.querySelector(".distancia").value
);
const angulo = leerAngulo(fila);
const esUltimoVertice = indice === filasVertices.length - 1;
if (!esUltimoVertice && !(distancia > 0)) {
throw new Error(
`Ingresa una distancia válida para el lado que sale de P${indice + 1}.`
);
}
return {
estacion: `P${indice + 1}`,
punto: esUltimoVertice ? "P1" : `P${indice + 2}`,
grados: fila.querySelector(".grados").value,
minutos: fila.querySelector(".minutos").value,
segundos: fila.querySelector(".segundos").value,
angulo,
// La distancia del último lado se calcula a partir del cierre geométrico.
distancia: esUltimoVertice ? 0 : distancia
};
});
return { orientacion, observaciones };
}
/* ===================== PROYECTO ===================== */
function leerDatosFormulario() {
const cantidad = Number($("cantidadVertices").value);
if (!Number.isInteger(cantidad) || cantidad < 3 || cantidad > 100) {
throw new Error(
"La cantidad de vértices debe ser un entero entre 3 y 100."
);
}
const norteReferencia = numero($("norteReferencia").value);
const esteReferencia = numero($("esteReferencia").value);
const norteAmarre = numero($("norteAmarre").value);
const esteAmarre = numero($("esteAmarre").value);
if (![norteReferencia, esteReferencia, norteAmarre, esteAmarre]
.every(Number.isFinite)) {
throw new Error(
"Completa las coordenadas Norte y Este de la armada y del amarre."
);
}
const observaciones = leerObservaciones();
return {
id: proyectoActualId || generarId(),
nombre: $("nombreProyecto").value.trim(),
fecha: $("fechaProyecto").value,
instrumento: $("instrumento").value.trim(),
estacionReferencia: $("estacionReferencia").value.trim(),
puntoAmarre: $("puntoAmarre").value.trim(),
norteReferencia,
esteReferencia,
norteAmarre,
esteAmarre,
cantidadVertices: cantidad,
tipoAngulo: $("tipoAngulo").value,
orientacion: observaciones.orientacion,
observaciones: observaciones.observaciones,
actualizado: new Date().toISOString()
};
}
function limpiarFormulario() {
formProyecto.reset();
$("estacionReferencia").value = "TT-17";
$("puntoAmarre").value = "AMARRE";
$("cantidadVertices").value = 5;
$("tipoAngulo").value = "interior";
$("fechaProyecto").value =
new Date().toLocaleDateString("en-CA");
generarObservaciones(5);
ocultarMensaje();
}
function nuevoProyecto() {
proyectoActualId = null;
modoEdicion = false;
ultimoResultado = null;
limpiarFormulario();
$("tituloFormulario").textContent = "Nuevo proyecto";
$("btnGuardarProyecto").textContent = "Guardar y calcular";
mostrarPanel(panelFormulario);
}
function abrirEdicion(id) {
const proyecto = proyectos.find(item => item.id === id);
if (!proyecto) {
alert("No se encontró el proyecto.");
return;
}
proyectoActualId = proyecto.id;
modoEdicion = true;
ultimoResultado = null;
$("nombreProyecto").value = proyecto.nombre;
$("fechaProyecto").value = proyecto.fecha;
$("instrumento").value = proyecto.instrumento || "";
$("estacionReferencia").value = proyecto.estacionReferencia;
$("puntoAmarre").value = proyecto.puntoAmarre;
$("norteReferencia").value = proyecto.norteReferencia;
$("esteReferencia").value = proyecto.esteReferencia;
$("norteAmarre").value = proyecto.norteAmarre;
$("esteAmarre").value = proyecto.esteAmarre;
$("cantidadVertices").value = proyecto.cantidadVertices;
$("tipoAngulo").value = proyecto.tipoAngulo;
generarObservaciones(
proyecto.cantidadVertices,
proyecto
);
$("tituloFormulario").textContent = "Editar proyecto";
$("btnGuardarProyecto").textContent = "Guardar y calcular";
ocultarMensaje();
mostrarPanel(panelFormulario);
}
function guardarProyecto(datos) {
const indice = proyectos.findIndex(
proyecto => proyecto.id === datos.id
);
if (indice >= 0) {
proyectos[indice] = datos;
} else {
proyectos.push(datos);
}
if (!guardarEnAlmacenamiento()) {
return false;
}
proyectoActualId = datos.id;
renderizarProyectos();
return true;
}
/* ===================== CÁLCULO TOPOGRÁFICO ===================== */
/*
Convenciones:
- Coordenadas: Norte y Este.
- Azimutes medidos desde el Norte, en sentido horario.
- La orientación observada se mide desde la visual al amarre
hacia P1, en sentido horario.
- Para el recorrido, los ángulos interiores se consideran
medidos desde la visual de retorno hacia la siguiente visual
en sentido horario.
IMPORTANTE:
Si el equipo registra ángulos a la izquierda, ángulos cenitales
u otra convención instrumental, la orientación y la fórmula de
propagación deben adaptarse al procedimiento de campo.
*/

function calcularPoligonal(datos) {
    const n = datos.cantidadVertices;
    const observaciones = datos.observaciones;

    if (observaciones.length !== n) {
        throw new Error(
            "La cantidad de observaciones no coincide con los vértices."
        );
    }

    const azimutArmadaAmarre = calcularAzimut(
        datos.norteReferencia,
        datos.esteReferencia,
        datos.norteAmarre,
        datos.esteAmarre
    );

    const distanciaArmadaAmarre = calcularDistancia(
        datos.norteReferencia,
        datos.esteReferencia,
        datos.norteAmarre,
        datos.esteAmarre
    );

    // Calcular el contraazimut entre armada y amarre
    const contraAzimutArmadaAmarre =
        azimutArmadaAmarre >= 180
            ? azimutArmadaAmarre - 180
            : azimutArmadaAmarre + 180;

    // Calcular el azimut de la visual armada → P1
    const azimutArmadaP1 = normalizarAzimut(
        contraAzimutArmadaAmarre + datos.orientacion.angulo
    );

    // Coordenadas iniciales de P1 usando la distancia de orientación
    const P1 = {
        norte: datos.norteReferencia +
            datos.orientacion.distancia *
            Math.cos(radianes(azimutArmadaP1)),

        este: datos.esteReferencia +
            datos.orientacion.distancia *
            Math.sin(radianes(azimutArmadaP1))
    };

    // A partir de aquí continúa el resto de tu código original.
console.log("Azimut armada → amarre:", azimutArmadaAmarre);
console.log("Contraazimut:", contraAzimutArmadaAmarre);
console.log("Ángulo de orientación:", datos.orientacion.angulo);
console.log("Azimut armada → P1:", azimutArmadaP1);
const angulosObservados = observaciones.map(item => item.angulo);

// Suma de ángulos observados de P1→P2 hasta el último vértice.
const sumaAngulos = angulosObservados.reduce(
    (acumulado, angulo) => acumulado + angulo,
    0
);

// Suma angular teórica.
const tipo = datos.tipoAngulo;
let sumaTeorica;

if (tipo === "interior") {
    sumaTeorica = (n - 2) * 180;
} else {
    sumaTeorica = (n + 2) * 180;
}

// Error angular = suma teórica - suma observada.
const errorAngular = sumaTeorica - sumaAngulos;

// Distribuir el error entre todos los vértices.
const correccionAngular = errorAngular / n;

// Aplicar la corrección a cada ángulo de los vértices.
const angulosCorregidos = angulosObservados.map(
    angulo => angulo + correccionAngular
);

// Validación única.
if (angulosCorregidos.some(angulo => angulo <= 0)) {
    throw new Error(
        "El ajuste produjo un ángulo no positivo. Revisa el tipo y las observaciones."
    );
}

/*
Calcular azimutes de los lados.
El azimut de P1 -> armada se obtiene de las coordenadas
conocidas de ambos puntos.
*/
/*
Calcular azimutes de los lados.
El azimut de P1 -> armada se obtiene de las coordenadas
conocidas de ambos puntos.
*/
const azimutP1Armada = calcularAzimut(
P1.norte,
P1.este,
datos.norteReferencia,
datos.esteReferencia
);
let azimutAnterior = azimutP1Armada;

const lados = [];

// ==================================================
// 1. CALCULAR AZIMUTS DE LOS LADOS
// ==================================================

let azimutActual = 0;
let azimutPrevio = azimutP1Armada;
const azimutesLados = [];

for (let i = 0; i < n; i++) {
    if (tipo === "interior") {
        azimutActual = normalizarAzimut(
            azimutPrevio + angulosCorregidos[i]
        );
    } else {
        azimutActual = normalizarAzimut(
            azimutPrevio + 180 - angulosCorregidos[i]
        );
    }

    azimutesLados.push(azimutActual);

    azimutPrevio = normalizarAzimut(
        azimutActual + 180
    );
}

// ==================================================
// 2. TRAMO TT-17 -> P1
// SÍ participa en la compensación
// ==================================================

const distanciaOrientacion = datos.orientacion.distancia;

const proyeccionNorteOrientacion =
    distanciaOrientacion *
    Math.cos(radianes(azimutArmadaP1));

const proyeccionEsteOrientacion =
    distanciaOrientacion *
    Math.sin(radianes(azimutArmadaP1));

lados.push({
    estacion: datos.estacionReferencia,
    punto: "P1",
    anguloObservado: datos.orientacion.angulo,
    anguloCorregido: null,
    azimut: azimutArmadaP1,
    distancia: distanciaOrientacion,
    proyeccionNorte: proyeccionNorteOrientacion,
    proyeccionEste: proyeccionEsteOrientacion,
    esOrientacion: true,
    esCierre: false
});

// ==================================================
// 3. TRAMOS DE LA POLIGONAL
// Excluir el último tramo Pn -> P1
// ==================================================

for (let i = 0; i < n - 1; i++) {
    const distancia = observaciones[i].distancia;
    const azimut = azimutesLados[i];

    const proyeccionNorte =
        distancia * Math.cos(radianes(azimut));

    const proyeccionEste =
        distancia * Math.sin(radianes(azimut));

    lados.push({
        estacion: `P${i + 1}`,
        punto: `P${i + 2}`,
        anguloObservado: angulosObservados[i],
        anguloCorregido: angulosCorregidos[i],
        azimut,
        distancia,
        proyeccionNorte,
        proyeccionEste,
        esOrientacion: false,
        esCierre: false
    });
}

// ==================================================
// 4. SUMAS DE PROYECCIONES Y PERÍMETRO
// ==================================================

const ladosCalculables = lados.filter(
    lado => !lado.esCierre
);

const sumaProyeccionesN = ladosCalculables.reduce(
    (suma, lado) => suma + lado.proyeccionNorte,
    0
);

const sumaProyeccionesE = ladosCalculables.reduce(
    (suma, lado) => suma + lado.proyeccionEste,
    0
);

const errorLineal = Math.hypot(
    sumaProyeccionesN,
    sumaProyeccionesE
);

const perimetro = ladosCalculables.reduce(
    (suma, lado) => suma + lado.distancia,
    0
);

if (!(perimetro > 0)) {
    throw new Error(
        "El perímetro debe ser mayor que cero."
    );
}


 // ==================================================
 // 5. COMPENSACIÓN BOWDITCH
 // ==================================================

 let norteAcumulado = datos.norteReferencia;
 let esteAcumulado = datos.esteReferencia;

 const resultados = [];

 // --------------------------------------------------
 // TT-17: COORDENADAS INICIALES
 // --------------------------------------------------

 resultados.push({
     estacion: datos.estacionReferencia,
     punto: datos.estacionReferencia,
     anguloObservado: null,
     anguloCorregido: null,
     azimut: null,
     distancia: null,
     proyeccionNorte: null,
     proyeccionEste: null,
     correccionNorte: null,
     correccionEste: null,
     proyeccionNorteCorregida: null,
     proyeccionEsteCorregida: null,
     norte: datos.norteReferencia,
     este: datos.esteReferencia,
     esInicio: true,
     esCierre: false
 });

 // --------------------------------------------------
 // CÁLCULOS DE BOWDITCH
 // --------------------------------------------------

 for (const lado of ladosCalculables) {
     const proporcion = lado.distancia / perimetro;

     const correccionNorte =
         -sumaProyeccionesN * proporcion;

     const correccionEste =
         -sumaProyeccionesE * proporcion;

     const proyeccionNorteCorregida =
         lado.proyeccionNorte + correccionNorte;

     const proyeccionEsteCorregida =
         lado.proyeccionEste + correccionEste;

     norteAcumulado += proyeccionNorteCorregida;
     esteAcumulado += proyeccionEsteCorregida;

     resultados.push({
         ...lado,
         correccionNorte,
         correccionEste,
         proyeccionNorteCorregida,
         proyeccionEsteCorregida,
         norte: norteAcumulado,
         este: esteAcumulado,
         esInicio: false,
         esCierre: false
     });
 }

 // --------------------------------------------------
 // ÚLTIMO VÉRTICE: Pn -> P1
 // SIN DISTANCIA NI PROYECCIONES
 // --------------------------------------------------

 const indiceUltimo = n - 1;

 resultados.push({
     estacion: `P${n}`,
     punto: "P1",

     anguloObservado:
         angulosObservados[indiceUltimo],

     anguloCorregido:
         angulosCorregidos[indiceUltimo],

     azimut:
         azimutesLados[indiceUltimo],

     distancia: null,
     proyeccionNorte: null,
     proyeccionEste: null,
     correccionNorte: null,
     correccionEste: null,
     proyeccionNorteCorregida: null,
     proyeccionEsteCorregida: null,

     // Coordenadas conocidas del punto de cierre.
     norte: datos.norteReferencia,
     este: datos.esteReferencia,

     esInicio: false,
     esCierre: true
 });


// ==================================================
// 6. PRECISIÓN RELATIVA
// ==================================================

const precisionRelativa = errorLineal > 0
    ? perimetro / errorLineal
    : Infinity;
mostrarCroquisPoligonal(resultados);
return {
azimutArmadaAmarre,
distanciaArmadaAmarre,
azimutArmadaP1,
puntoP1: P1,
sumaAngulos,
sumaTeorica,
errorAngular,
correccionAngular,
errorLineal,
sumaProyeccionesN,
sumaProyeccionesE,
perimetro,
precisionRelativa,
lados,
resultados
};
}
/* ===================== PRESENTACIÓN DE RESULTADOS ===================== */
function crearTarjetaResumen(titulo, valor) {
return `
<div class="tarjeta-resumen">
<span>${escaparHTML(titulo)}</span>
<strong>${escaparHTML(valor)}</strong>
</div>
`;
}
function mostrarResultados(datos, resultado) {
ultimoResultado = { datos, resultado };
$("tituloResultados").textContent =
`Resultados: ${datos.nombre}`;
$("subtituloResultados").textContent =
`Fecha: ${datos.fecha || "Sin fecha"} | ` +
`Instrumento: ${datos.instrumento || "No especificado"}`;
resumenCalculo.innerHTML = [
crearTarjetaResumen(
"Azimut armada → amarre",
`${formato(resultado.azimutArmadaAmarre, 4)}°`
),
crearTarjetaResumen(
"Azimut armada → P1",
`${formato(resultado.azimutArmadaP1, 4)}°`
),
crearTarjetaResumen(
"Error angular",
`${formato(resultado.errorAngular * 3600, 0)}″`
),
crearTarjetaResumen(
"Error lineal",
`${formato(resultado.errorLineal, 3)} m`
),
crearTarjetaResumen(
"Perímetro",
`${formato(resultado.perimetro, 3)} m`
),
crearTarjetaResumen(
"Precisión relativa",
Number.isFinite(resultado.precisionRelativa)
? `1:${Math.round(resultado.precisionRelativa).toLocaleString("es-CO")}`
: "Cierre perfecto"
),

crearTarjetaResumen(
    "Suma de ángulos observados",
    gradosADMS(resultado.sumaAngulos).texto
),

crearTarjetaResumen(
    "Suma angular teórica",
    gradosADMS(resultado.sumaTeorica).texto
)

].join("");
cuerpoResultados.innerHTML = "";
resultado.resultados.forEach(fila => {
const elemento = document.createElement("tr");
const dmsObservado = fila.anguloObservado == null
? "—"
: gradosADMS(fila.anguloObservado).texto;
const dmsCorregido = fila.anguloCorregido == null
? "—"
: gradosADMS(fila.anguloCorregido).texto;
elemento.innerHTML = `
<td>${escaparHTML(fila.estacion)}</td>
<td>${escaparHTML(fila.punto)}</td>
<td>${escaparHTML(dmsObservado)}</td>
<td>${escaparHTML(dmsCorregido)}</td>
<td>${gradosADMS(fila.azimut).texto}</td>
<td>${formato(fila.distancia, 3)}</td>
<td>${fila.proyeccionNorte == null
? "—" : formato(fila.proyeccionNorte, 3)}</td>
<td>${fila.proyeccionEste == null
? "—" : formato(fila.proyeccionEste, 3)}</td>
<td>${fila.proyeccionNorteCorregida == null
? "—" : formato(fila.proyeccionNorteCorregida, 3)}</td>
<td>${fila.proyeccionEsteCorregida == null
? "—" : formato(fila.proyeccionEsteCorregida, 3)}</td>
<td>${formato(fila.norte, 3)}</td>
<td>${formato(fila.este, 3)}</td>
`;
cuerpoResultados.appendChild(elemento);
});
mostrarPanel(panelResultados);
}
/* ===================== LISTA DE PROYECTOS ===================== */
function renderizarProyectos() {
if (!listaProyectos) return;
contadorProyectos.textContent =
`${proyectos.length} proyecto${proyectos.length === 1 ? "" : "s"}`;
mensajeVacio?.classList.toggle(
"oculto",
proyectos.length > 0
);
listaProyectos.innerHTML = "";
proyectos.forEach(proyecto => {
const tarjeta = document.createElement("article");
tarjeta.className = "tarjeta-proyecto";
tarjeta.innerHTML = `
<h4>${escaparHTML(proyecto.nombre)}</h4>
<p>
Fecha: ${escaparHTML(proyecto.fecha || "Sin fecha")}<br>
Estación: ${escaparHTML(proyecto.estacionReferencia)}<br>
Vértices: ${proyecto.cantidadVertices}<br>
Instrumento: ${escaparHTML(proyecto.instrumento || "No especificado")}
</p>
<div class="acciones-tarjeta">
<button type="button" data-accion="editar">
Abrir / editar
</button>
<button type="button" data-accion="eliminar"
class="eliminar">
Eliminar
</button>
</div>
`;
tarjeta.querySelector('[data-accion="editar"]')
.addEventListener("click", () => abrirEdicion(proyecto.id));
tarjeta.querySelector('[data-accion="eliminar"]')
.addEventListener("click", () => eliminarProyecto(proyecto.id));
listaProyectos.appendChild(tarjeta);
});
}
function eliminarProyecto(id) {
const proyecto = proyectos.find(item => item.id === id);
if (!proyecto) return;
if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?`)) {
return;
}
const anterior = proyectos;
proyectos = proyectos.filter(item => item.id !== id);
if (!guardarEnAlmacenamiento()) {
proyectos = anterior;
return;
}
if (proyectoActualId === id) {
proyectoActualId = null;
}
renderizarProyectos();
}
/* ===================== EXPORTACIÓN CSV ===================== */
function descargarArchivo(contenido, nombre, tipo) {
const blob = new Blob(
["\uFEFF", contenido],
{ type: `${tipo};charset=utf-8;` }
);
const url = URL.createObjectURL(blob);
const enlace = document.createElement("a");
enlace.href = url;
enlace.download = nombre;
document.body.appendChild(enlace);
enlace.click();
enlace.remove();
URL.revokeObjectURL(url);
}
function exportarCSV() {
if (!ultimoResultado) {
alert("Primero debes calcular la poligonal.");
return;
}
const { datos, resultado } = ultimoResultado;
const encabezados = [
"Estacion",
"Punto observado",
"Angulo observado grados",
"Angulo corregido grados",
"Azimut grados",
"Distancia m",
"Proyeccion Norte m",
"Proyeccion Este m",
"Correccion Norte m",
"Correccion Este m",
"Norte m",
"Este m"
];
const filas = resultado.resultados.map(fila => [
fila.estacion,
fila.punto,
fila.anguloObservado ?? "",
fila.anguloCorregido ?? "",
fila.azimut,
fila.distancia,
fila.proyeccionNorte ?? "",
fila.proyeccionEste ?? "",
fila.correccionNorte ?? "",
fila.correccionEste ?? "",
fila.norte,
fila.este
]);
const csv = [
encabezados,
...filas
].map(fila => fila.map(valor => {
const texto = String(valor ?? "");
return `"${texto.replace(/"/g, '""')}"`;
}).join(";")).join("\r\n");
const nombre = (datos.nombre || "poligonal")
.replace(/[<>:"/\|?*]/g, "_")
.replace(/\s+/g, "_");
descargarArchivo(
csv,
`${nombre}_resultados.csv`,
"text/csv"
);
}
/* ===================== EVENTOS ===================== */
$("btnNuevoProyecto")?.addEventListener("click", nuevoProyecto);
$("btnCrearDesdeVacio")?.addEventListener("click", nuevoProyecto);
$("btnVolverProyectos")?.addEventListener("click", () => {
ocultarMensaje();
mostrarPanel(panelProyectos);
renderizarProyectos();
});
$("btnVolverResultados")?.addEventListener("click", () => {
mostrarPanel(panelProyectos);
renderizarProyectos();
});
$("btnCancelarFormulario")?.addEventListener("click", () => {
ocultarMensaje();
mostrarPanel(panelProyectos);
renderizarProyectos();
});
$("btnEditarProyecto")?.addEventListener("click", () => {
if (proyectoActualId) {
abrirEdicion(proyectoActualId);
}
});
$("btnExportarCSV")?.addEventListener("click", exportarCSV);
$("btnCerrarSesion")?.addEventListener("click", () => {
if (confirm("¿Deseas cerrar la sesión?")) {
window.location.href = "MENU.html";
}
});
[
"norteReferencia",
"esteReferencia",
"norteAmarre",
"esteAmarre"
].forEach(id => {
$(id)?.addEventListener("input", actualizarOrientacion);
});
$("cantidadVertices")?.addEventListener("change", () => {
const cantidad = Number($("cantidadVertices").value);
if (!Number.isInteger(cantidad) || cantidad < 3 || cantidad > 100) {
mostrarMensaje(
"Ingresa una cantidad de vértices entre 3 y 100."
);
return;
}
// Al cambiar el número de vértices se reconstruyen las filas.
// Si hay datos que conservar, guarda el proyecto antes de cambiar.
generarObservaciones(cantidad);
ocultarMensaje();
});
$("estacionReferencia")?.addEventListener("change", () => {
const cantidad = Number($("cantidadVertices").value);
generarObservaciones(cantidad);
});
$("puntoAmarre")?.addEventListener("change", () => {
const cantidad = Number($("cantidadVertices").value);
generarObservaciones(cantidad);
});
formProyecto?.addEventListener("submit", evento => {
evento.preventDefault();
ocultarMensaje();
try {
if (!formProyecto.checkValidity()) {
formProyecto.reportValidity();
return;
}
const datos = leerDatosFormulario();
const resultado = calcularPoligonal(datos);
if (!guardarProyecto(datos)) return;
mostrarResultados(datos, resultado);
} catch (error) {
mostrarMensaje(
error.message || "Ocurrió un error al calcular la poligonal.",
"error"
);
console.error(error);
}
});
/* ===================== INICIALIZACIÓN ===================== */
function iniciarAplicacion() {
if ($("fechaProyecto")) {
$("fechaProyecto").value =
new Date().toLocaleDateString("en-CA");
}
generarObservaciones(
Number($("cantidadVertices")?.value || 5)
);
renderizarProyectos();
actualizarOrientacion();
mostrarPanel(panelProyectos);
}
iniciarAplicacion();

/**
 * Convierte grados decimales a formato GG° MM' SS"
 * Ejemplo: 1440.004167 -> 1440° 00' 15.001"
 */
function formatearGMS(gradosDecimales) {
    const signo = gradosDecimales < 0 ? "-" : "";
    const valorAbsoluto = Math.abs(gradosDecimales);

    let grados = Math.floor(valorAbsoluto);
    let minutosDecimales = (valorAbsoluto - grados) * 60;
    let minutos = Math.floor(minutosDecimales);
    let segundos = (minutosDecimales - minutos) * 60;

    // Redondear los segundos a 3 decimales
    segundos = Math.round(segundos * 1000) / 1000;

    // Corregir posibles desbordamientos por redondeo
    if (segundos >= 60) {
        segundos = 0;
        minutos++;
    }

    if (minutos >= 60) {
        minutos = 0;
        grados++;
    }

    return `${signo}${grados}° ${String(minutos).padStart(2, "0")}' ${segundos
        .toFixed(3)
        .padStart(6, "0")}"`;
}


function mostrarCroquisPoligonal(resultados) {
    // Obtener las coordenadas de los vértices calculados
    const mapaPuntos = new Map();

    resultados.forEach(fila => {
        const nombre = String(fila.punto ?? "").trim();

        if (!/^P\d+$/i.test(nombre)) return;

        const norte = Number(fila.norte);
        const este = Number(fila.este);

        if (!Number.isFinite(norte) || !Number.isFinite(este)) {
            return;
        }

        // Conservar la primera coordenada válida de cada punto
        const clave = nombre.toUpperCase();

        if (!mapaPuntos.has(clave)) {
            mapaPuntos.set(clave, {
                nombre: clave,
                norte,
                este
            });
        }
    });

    const puntos = [...mapaPuntos.values()].sort(
        (a, b) =>
            Number(a.nombre.substring(1)) -
            Number(b.nombre.substring(1))
    );

    if (puntos.length < 3) {
        console.warn(
            "No hay suficientes coordenadas para dibujar la poligonal."
        );
        return;
    }

    // Eliminar el croquis anterior si ya existe
    document.getElementById("croquisPoligonal")?.remove();

    // Crear el contenedor
    const contenedor = document.createElement("section");
    contenedor.id = "croquisPoligonal";

    contenedor.style.cssText = `
        max-width: 900px;
        margin: 30px auto;
        padding: 20px;
        background: #ffffff;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        font-family: Arial, sans-serif;
        color: #252525;
    `;

    contenedor.innerHTML = `
        <h2 style="
            margin: 0 0 6px;
            color: #17365d;
            text-align: center;
        ">
            Croquis de la poligonal cerrada
        </h2>

        <p style="
            text-align: center;
            color: #777;
            font-size: 13px;
            margin-bottom: 15px;
        ">
            Representación basada en las coordenadas calculadas
        </p>

        <div id="lienzoCroquis" style="width:100%;"></div>

        <p style="
            text-align:center;
            font-size:12px;
            color:#777;
            margin-bottom:0;
        ">
            Croquis esquemático · No está dibujado a escala de impresión
        </p>
    `;

    document.body.appendChild(contenedor);

    // Dimensiones del dibujo
    const ancho = 700;
    const alto = 440;
    const margen = 55;

    const norteMin = Math.min(...puntos.map(p => p.norte));
    const norteMax = Math.max(...puntos.map(p => p.norte));
    const esteMin = Math.min(...puntos.map(p => p.este));
    const esteMax = Math.max(...puntos.map(p => p.este));

    const rangoN = norteMax - norteMin || 1;
    const rangoE = esteMax - esteMin || 1;

    // Mantener la misma escala en ambos ejes
    const escala = Math.min(
        (ancho - 2 * margen) / rangoE,
        (alto - 2 * margen) / rangoN
    );

    const dibujoAncho = rangoE * escala;
    const dibujoAlto = rangoN * escala;

    const desplazamientoX = (ancho - dibujoAncho) / 2;
    const desplazamientoY = (alto - dibujoAlto) / 2;

    const coordenadasDibujo = puntos.map(p => ({
        ...p,
        x: desplazamientoX + (p.este - esteMin) * escala,
        y: alto - desplazamientoY -
            (p.norte - norteMin) * escala
    }));

    // Dibujar los lados y cerrar el polígono
    const listaXY = coordenadasDibujo
        .map(p => `${p.x},${p.y}`)
        .join(" ");

    const etiquetas = coordenadasDibujo.map(p => `
        <circle
            cx="${p.x}"
            cy="${p.y}"
            r="5"
            fill="#b8323c"
            stroke="#ffffff"
            stroke-width="2"
        />

        <text
            x="${p.x + 9}"
            y="${p.y - 9}"
            font-size="13"
            font-weight="bold"
            fill="#17365d"
        >${p.nombre}</text>
    `).join("");

    // Flecha Norte
    const flechaNorte = `
        <g transform="translate(${ancho - 45},65)">
            <text x="0" y="-18"
                text-anchor="middle"
                font-size="15"
                font-weight="bold"
                fill="#17365d">N</text>
            <line x1="0" y1="35" x2="0" y2="-8"
                stroke="#17365d" stroke-width="2"/>
            <polygon points="0,-15 -6,-3 6,-3"
                fill="#17365d"/>
        </g>
    `;

    document.getElementById("lienzoCroquis").innerHTML = `
        <svg
            viewBox="0 0 ${ancho} ${alto}"
            role="img"
            aria-label="Croquis de la poligonal cerrada"
            style="
                display:block;
                width:100%;
                height:auto;
                background:#f8fafc;
                border-radius:8px;
            "
        >
            <polygon
                points="${listaXY}"
                fill="#dce8f5"
                fill-opacity="0.75"
                stroke="#17365d"
                stroke-width="2.5"
                stroke-linejoin="round"
            />

            ${etiquetas}
            ${flechaNorte}
        </svg>
    `;

    // Desplazarse hasta el croquis recién creado
    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function eliminarCroquisPoligonal() {
    document.getElementById("croquisPoligonal")?.remove();
}
