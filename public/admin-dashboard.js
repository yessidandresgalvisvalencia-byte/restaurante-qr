const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("restaurant") || "rest1";
const modoDashboard = params.get("modo") || "automatico";

async function obtenerDatosPareto() {
  if (modoDashboard === "manual") {
    const datosManuales =
      JSON.parse(localStorage.getItem(`dashboard_manual_${restaurantId}`)) || [];

    return datosManuales.sort((a, b) => Number(b.ventas || 0) - Number(a.ventas || 0));
  }

  const respuesta = await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

  if (!respuesta.ok) {
    throw new Error("No se pudo cargar /estadisticas/pareto");
  }

  return await respuesta.json();
}

function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(valor || 0);
}

function limpiarTexto(texto = "") {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tipoProducto(nombre = "") {
  const n = limpiarTexto(nombre);

  if (n.includes("coca") || n.includes("gaseosa") || n.includes("limonada") || n.includes("jugo") || n.includes("agua") || n.includes("bebida")) return "bebida";
  if (n.includes("papa") || n.includes("papas") || n.includes("yuca") || n.includes("arroz") || n.includes("ensalada") || n.includes("aguacate") || n.includes("arepa")) return "acompanante";
  if (n.includes("empanada") || n.includes("entrada") || n.includes("picada") || n.includes("chorizo") || n.includes("morcilla")) return "entrada";
  if (n.includes("sancocho") || n.includes("sopa") || n.includes("ajiaco") || n.includes("mondongo")) return "tradicional";
  if (n.includes("carne") || n.includes("punta") || n.includes("anca") || n.includes("pollo") || n.includes("chuzo") || n.includes("asada") || n.includes("lomo") || n.includes("costilla")) return "plato_fuerte";
  if (n.includes("hamburguesa") || n.includes("pizza") || n.includes("perro") || n.includes("salchipapa")) return "comida_rapida";
  if (n.includes("helado") || n.includes("postre") || n.includes("torta") || n.includes("brownie")) return "postre";

  return "producto";
}

function enriquecerDatos(datos) {
  return datos.map(item => ({
    ...item,
    producto: item.producto || "Producto sin nombre",
    ventas: Number(item.ventas || 0),
    totalDinero: Number(item.totalDinero || 0),
    tipo: tipoProducto(item.producto || "")
  }));
}

function esCompatible(a, b) {
  if (!a || !b) return false;
  if (a.producto === b.producto) return false;

  const t1 = a.tipo;
  const t2 = b.tipo;

  if (t1 === "bebida" && t2 === "bebida") return false;
  if (t1 === "acompanante" && t2 === "acompanante") return false;
  if (t1 === "postre" && ["plato_fuerte", "tradicional"].includes(t2)) return false;
  if (t2 === "postre" && ["plato_fuerte", "tradicional"].includes(t1)) return false;

  return true;
}

function buscarComplementoCompatible(base, datos) {
  return datos.find(item => esCompatible(base, item));
}

function obtenerParesCompatibles(datos, maximo = 4) {
  const pares = [];

  for (let i = 0; i < datos.length; i++) {
    for (let j = i + 1; j < datos.length; j++) {
      if (esCompatible(datos[i], datos[j])) {
        pares.push([datos[i], datos[j]]);
      }
    }
  }

  return pares.slice(0, maximo);
}

function hayEmpateReal(datos) {
  if (datos.length < 2) return false;
  return Number(datos[0].ventas || 0) === Number(datos[1].ventas || 0);
}

function random(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

async function cargarDashboard() {
  try {
    let datos = await obtenerDatosPareto();
    datos = enriquecerDatos(datos);

    if (!datos || datos.length === 0) {
      document.getElementById("recomendaciones").innerHTML = `
        <div class="recommendation warning">
          No hay datos suficientes para generar recomendaciones.
        </div>
      `;
      return;
    }

    const productos = datos.map(item => item.producto);
    const ventas = datos.map(item => Number(item.ventas || 0));
    const dinero = datos.map(item => Number(item.totalDinero || 0));

    const totalPedidos = ventas.reduce((a, b) => a + b, 0);
    const totalDinero = dinero.reduce((a, b) => a + b, 0);
    const ticketPromedio = totalPedidos > 0 ? totalDinero / totalPedidos : 0;
    const productoTop = datos[0];

    document.getElementById("totalVentas").textContent = formatoMoneda(totalDinero);
    document.getElementById("totalPedidos").textContent = totalPedidos;
    document.getElementById("topProducto").textContent = productoTop.producto;
    document.getElementById("totalProductos").textContent = datos.length;
    document.getElementById("ticketPromedio").textContent = formatoMoneda(ticketPromedio);

    const total = ventas.reduce((a, b) => a + b, 0);
    let acumulado = 0;

    const porcentajeAcumulado = ventas.map(valor => {
      acumulado += valor;
      return total > 0 ? Number(((acumulado / total) * 100).toFixed(2)) : 0;
    });

    const canvas = document.getElementById("graficaProductos");

    new Chart(canvas, {
      data: {
        labels: productos,
        datasets: [
          {
            type: "bar",
            label: "Cantidad vendida",
            data: ventas,
            yAxisID: "y"
          },
          {
            type: "line",
            label: "% acumulado",
            data: porcentajeAcumulado,
            yAxisID: "y1",
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#ffffff" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#cbd5e1" },
            grid: { color: "rgba(255,255,255,0.06)" }
          },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: { color: "#cbd5e1" },
            title: {
              display: true,
              text: "Cantidad vendida",
              color: "#cbd5e1"
            },
            grid: { color: "rgba(255,255,255,0.08)" }
          },
          y1: {
            beginAtZero: true,
            max: 100,
            position: "right",
            ticks: { color: "#cbd5e1" },
            title: {
              display: true,
              text: "% acumulado",
              color: "#cbd5e1"
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    cargarRecomendacionesSmith(datos, totalPedidos, ticketPromedio);

  } catch (error) {
    console.error(error);
    document.getElementById("recomendaciones").innerHTML = `
      <div class="recommendation warning">
        Error cargando el dashboard. Revisa los datos manuales o la ruta de estadísticas.
      </div>
    `;
  }
}
function aplicarEstrategia(
numero,
titulo,
productos = []
) {

const estrategiasGuardadas =

JSON.parse(
localStorage.getItem(
`estrategias_${restaurantId}`
)
) || [];

const yaExiste =
estrategiasGuardadas.find(
e => e.numero === numero
);

if (!yaExiste) {

estrategiasGuardadas.push({

numero,
titulo,
productos,
fecha: new Date().toISOString()

});

}

localStorage.setItem(

`estrategias_${restaurantId}`,

JSON.stringify(
estrategiasGuardadas
)

);

alert(
`Estrategia ${numero} aplicada correctamente`
);

window.location.href =
`/admin.html?restaurantId=${restaurantId}`;

}

function aplicarTodasLasEstrategias() {

const botones =
document.querySelectorAll(
"[data-estrategia]"
);

botones.forEach(btn => {

const numero =
btn.dataset.estrategia;

const titulo =
btn.dataset.titulo;

const productos =
JSON.parse(
btn.dataset.productos || "[]"
);

const estrategiasGuardadas =

JSON.parse(
localStorage.getItem(
`estrategias_${restaurantId}`
)
) || [];

const yaExiste =
estrategiasGuardadas.find(
e => e.numero === numero
);

if (!yaExiste) {

estrategiasGuardadas.push({

numero,
titulo,
productos,
fecha: new Date().toISOString()

});

}

localStorage.setItem(

`estrategias_${restaurantId}`,

JSON.stringify(
estrategiasGuardadas
)

);

});

alert(
"Todas las estrategias fueron aplicadas"
);

window.location.href =
`/admin.html?restaurantId=${restaurantId}`;

}

function cargarRecomendacionesSmith(datos, totalPedidos, ticketPromedio) {
  const contenedor = document.getElementById("recomendaciones");

  const top = datos[0];
  const segundo = datos[1];
  const tercero = datos[2];

  const empate = hayEmpateReal(datos);
  const complemento = buscarComplementoCompatible(top, datos);
  const pares = obtenerParesCompatibles(datos, 4);
  const bajaRotacion = datos.filter(p => Number(p.ventas) <= 2);

  const participacion =
    totalPedidos > 0 ? ((top.ventas / totalPedidos) * 100).toFixed(1) : 0;

  const frasesDemanda = [
    `El mercado ya está mostrando una preferencia clara por ${top.producto}.`,
    `${top.producto} concentra una señal fuerte de demanda dentro del menú.`,
    `Los clientes están respondiendo positivamente a ${top.producto}.`,
    `${top.producto} funciona como un producto con tracción real, no como una apuesta al azar.`,
    `La rotación de ${top.producto} indica que existe una validación comercial importante.`
  ];

  const frasesEspecializacion = [
    `concentrar la atención comercial en los productos que ya muestran mayor eficiencia.`,
    `usar el producto con mayor demanda como eje del menú y no dispersar esfuerzos en todo por igual.`,
    `convertir el producto líder en una referencia visual dentro del menú digital.`,
    `especializar la venta alrededor de productos con mayor capacidad de rotación.`,
    `organizar el menú para que el cliente encuentre primero las opciones con mejor desempeño.`
  ];

  const frasesValor = [
    `No se trata de bajar precios, sino de aumentar el valor percibido del pedido.`,
    `El cliente debe sentir que recibe una experiencia más completa, no simplemente más productos.`,
    `El precio debe proteger la percepción de calidad y no convertir el menú en una carrera de descuentos.`,
    `La rentabilidad mejora cuando el valor agregado es claro para el cliente.`,
    `Un buen combo debe sentirse útil, lógico y conveniente, no barato por desesperación.`
  ];

  const frasesCapital = [
    `Los productos con alta rotación ayudan a recuperar más rápido el dinero invertido en insumos y operación.`,
    `La circulación constante de productos mejora flujo de caja y reduce riesgo de inventario quieto.`,
    `La rentabilidad no depende solo del precio alto, sino de qué tan rápido rota el producto.`,
    `Un menú eficiente mueve capital de manera constante y evita desperdicio.`,
    `Los productos líderes deben ayudar a financiar el crecimiento del restaurante.`
  ];

  const frasesEmpatia = [
    `El cliente no compra únicamente comida; también compra confianza, antojo y sensación de valor.`,
    `Una descripción más humana puede aumentar la conexión emocional con el producto.`,
    `Las fotos, nombres y descripciones deben ayudar al cliente a imaginar la experiencia antes de pedir.`,
    `La decisión de compra mejora cuando el menú entiende cómo piensa y siente el cliente.`,
    `La presentación del producto debe hablarle al deseo del cliente, no solo informar ingredientes.`
  ];

  let html = "";

  if (empate) {
    const par1 = pares[0];
    const par2 = pares[1];

    html += `
      <div class="recommendation warning">
        <span class="strategy-label">Estrategia 1 · Lectura objetiva del mercado</span>
        <h3>1. Probar antes de declarar un producto ganador</h3>
        <p>
          Las ventas están muy parejas. GRUK no debe inventar un producto líder cuando el mercado todavía no lo ha definido.
        </p>
        <p>
          <strong>Acción:</strong> realizar una prueba de 7 días con combinaciones coherentes.
          ${par1 ? `Primera prueba: <strong>${par1[0].producto} + ${par1[1].producto}</strong>.` : ""}
          ${par2 ? ` Segunda prueba: <strong>${par2[0].producto} + ${par2[1].producto}</strong>.` : ""}
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> la decisión se basa en demanda real, no en intuición. El cliente revela qué combinación tiene mayor valor.
        </p>
      </div>
    `;
  } else {
    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 1 · Producto ancla y especialización</span>
        <h3>1. Convertir ${top.producto} en eje de rentabilidad</h3>
        <p>
          ${random(frasesDemanda)} Representa aproximadamente <strong>${participacion}%</strong> de los pedidos.
        </p>
        <p>
          <strong>Acción:</strong> ${random(frasesEspecializacion)}
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> se aplica especialización comercial: el restaurante enfoca recursos, atención y presentación en lo que ya demostró demanda.
        </p>
      </div>
    `;
  }

  if (complemento) {
    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 2 · Venta cruzada compatible</span>
        <h3>2. Crear una combinación rentable con sentido real</h3>
        <p>
          GRUK detectó una combinación coherente:
          <strong>${top.producto} + ${complemento.producto}</strong>.
          Esta recomendación evita mezclas absurdas como bebida con bebida o productos que no se consumen naturalmente juntos.
        </p>
        <p>
          <strong>Acción:</strong> presentar esta combinación como sugerencia antes de finalizar el pedido.
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> el cliente ya tiene intención de compra. El complemento aparece como mejora natural, aumentando ticket promedio sin parecer venta forzada.
        </p>
      </div>
    `;
  }

  if (segundo && tercero) {
    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 3 · Competencia interna del menú</span>
        <h3>3. Crear una sección “Los más pedidos”</h3>
        <button

data-estrategia="3"

data-titulo="Los más pedidos de la casa"

data-productos='${JSON.stringify([

top.producto,
segundo.producto,
tercero.producto

])}'

onclick='aplicarEstrategia(

3,

"Los más pedidos de la casa",

${JSON.stringify([

top.producto,
segundo.producto,
tercero.producto

])}

)'>

Aplicar estrategia 3

</button>
        <p>
          <strong>${top.producto}</strong>, <strong>${segundo.producto}</strong> y <strong>${tercero.producto}</strong>
          muestran señales de aceptación. El menú debe permitir que los productos compitan por visibilidad según su desempeño real.
        </p>
        <p>
          <strong>Acción:</strong> ubicar estos productos en una sección superior llamada “Los más pedidos de la casa”.
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> muchos clientes confían en lo que otros ya compran. Esto reduce indecisión y aumenta conversión.
        </p>
      </div>
    `;
  }

  html += `
    <div class="recommendation">
      <span class="strategy-label">Estrategia 4 · Precio, valor y margen</span>
      <h3>4. Aumentar ingresos sin destruir rentabilidad</h3>
      <p>
        ${random(frasesValor)}
      </p>
      <p>
        <strong>Acción:</strong> evitar descuentos generales. Si se lanza promoción, que sea sobre productos compatibles y medible durante 7 días.
      </p>
      <p>
        <strong>Por qué funcionaría:</strong> se protege el margen, se mantiene la percepción de calidad y se evita acostumbrar al cliente a comprar solo con descuento.
      </p>
    </div>

    <div class="recommendation">
      <span class="strategy-label">Estrategia 5 · Capital circulante e inventario</span>
      <h3>5. Priorizar productos que mueven caja</h3>
      <p>
        ${random(frasesCapital)}
      </p>
      <p>
        <strong>Acción:</strong> usar los productos con mayor rotación para sostener flujo de caja y financiar mejoras del menú.
      </p>
      <p>
        <strong>Por qué funcionaría:</strong> un restaurante crece cuando convierte inventario en dinero de forma constante y reinvierte en lo que funciona.
      </p>
    </div>

    <div class="recommendation">
      <span class="strategy-label">Estrategia 6 · Empatía comercial</span>
      <h3>6. Hacer que el menú conecte con el deseo del cliente</h3>
      <p>
        ${random(frasesEmpatia)}
      </p>
      <p>
        <strong>Acción:</strong> mejorar fotos, nombres y descripciones para que cada producto transmita antojo, confianza y claridad.
      </p>
      <p>
        <strong>Por qué funcionaría:</strong> la compra no es solo racional; también responde a percepción, deseo y confianza.
      </p>
    </div>
  `;

  if (bajaRotacion.length > 0) {
    html += `
      <div class="recommendation danger">
        <span class="strategy-label">Estrategia 7 · Espectador imparcial</span>
        <h3>7. Revisar productos con baja rotación sin sesgo</h3>
        <ul>
          ${bajaRotacion.map(p => `<li><strong>${p.producto}</strong>: ${p.ventas} ventas</li>`).join("")}
        </ul>
        <p>
          Antes de eliminarlos, revisa precio, foto, descripción, ubicación y compatibilidad con otros productos.
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> el restaurante toma decisiones objetivas y no se queda con productos solo por gusto personal.
        </p>
      </div>
    `;
  }

  html += `
    <div class="recommendation">
      <span class="strategy-label">Base económica aplicada</span>
      <h3>Cómo GRUK está pensando la estrategia</h3>
      <p>
        El análisis combina especialización, interés propio, señales del mercado, precio frente a valor,
        trabajo operativo, capital circulante, reinversión, frugalidad, oferta y demanda,
        competencia, empatía del consumidor y evaluación objetiva.
      </p>
      <p>
        Por eso GRUK no recomienda combinaciones incoherentes. El objetivo es gestionar estrategicamente el portafolio de productos con enfoque en margen,
        compatible y creíble para el cliente.
      </p>
    </div>
  `;
  html += `

<div class="recommendation">

<h3>
Aplicar estrategias
</h3>

<button
onclick="aplicarTodasLasEstrategias()">

Aplicar todas

</button>

</div>

`;

  contenedor.innerHTML = html;
}


document.addEventListener("DOMContentLoaded", cargarDashboard);