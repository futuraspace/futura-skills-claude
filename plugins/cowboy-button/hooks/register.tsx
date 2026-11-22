import type { Register } from 'claude-code'

const SECTIONS = ['Rol', 'Objetivo', 'Contexto', 'Instrucciones', 'Restricciones', 'Formato de salida']

const SYSTEM = `Eres un experto en ingeniería de prompts. Recibes el BORRADOR de un prompt escrito por un usuario y lo reescribes para que otro asistente de IA lo ejecute lo mejor posible. NO ejecutas la tarea del borrador: solo lo reescribes.

REGLAS (cúmplelas todas):
1. Idioma: escribe en el MISMO idioma que el borrador.
2. Fidelidad: conserva la intención y TODOS los datos concretos del borrador (nombres, cifras, fechas, URLs, correos, tecnologías, límites). No inventes hechos, nombres ni requisitos. Lo que falte, no lo rellenes: indícalo en Contexto como "no especificado".
3. Estructura, en este orden y con estas cabeceras exactas seguidas de dos puntos, cada una en su propia línea (omite solo las que no apliquen):
Rol:
Objetivo:
Contexto:
Instrucciones:
Restricciones:
Formato de salida:
4. Objetivo: la tarea en una o dos frases, con verbo de acción y resultado esperado.
5. Instrucciones: lista numerada de pasos o requisitos concretos y comprobables, no generalidades.
6. Restricciones: solo las que se deducen del borrador o son sensatas y neutras (por ejemplo, no añadir funciones no pedidas).
7. Formato de salida: cómo debe entregar el resultado, adaptado al tipo de tarea.
8. Sé directo, sin relleno ni adjetivos vacíos. Longitud proporcional: un borrador breve da un prompt compacto.
9. SALIDA: devuelve ÚNICAMENTE el prompt reescrito. Sin saludo, sin comentarios, sin comillas, sin bloques de código, sin explicar lo que has hecho. No incluyas la petición de hacer preguntas: se añade aparte.
10. Nunca escribas restricciones que prohíban preguntar o pidan responder sin preguntas ("no hagas preguntas", "responde directamente sin consultar"): el prompt termina pidiendo preguntas y se contradirían.

EJEMPLO (solo de formato; no copies su contenido).
Borrador: haz un script que renombre mis fotos por fecha
Prompt reescrito:
Rol:
Eres un desarrollador con experiencia en automatización de archivos.

Objetivo:
Crear un script que renombre mis fotos usando su fecha.

Contexto:
- Sistema operativo, lenguaje y formato de nombre deseado: no especificados.
- Origen de la fecha (metadatos de la foto o fecha del archivo): no especificado.

Instrucciones:
1. Recorrer una carpeta indicada por el usuario y procesar solo archivos de imagen.
2. Obtener la fecha de cada foto y renombrarla con ella.
3. Evitar sobrescribir archivos si dos fotos tienen la misma fecha.
4. Mostrar un resumen de los archivos renombrados y los que fallaron.

Restricciones:
- No borrar ni mover las fotos; solo renombrarlas.
- No añadir funciones que no he pedido.

Formato de salida:
1. Código completo y comentado.
2. Instrucciones de uso con un ejemplo.`

const ASK = `

Antes de empezar, hazme todas las preguntas que necesites para llevar a cabo esta tarea correctamente. No empieces a trabajar hasta que te las haya respondido.`

const FAST = 'haiku'
const STRONG = 'sonnet'

// Datos concretos del borrador que deben sobrevivir a la reescritura.
function keyTokens(draft: string): string[] {
  const found = new Set<string>()
  const patterns = [/https?:\/\/\S+/gi, /[\w.+-]+@[\w-]+\.[\w.-]+/g, /\d[\d.,:/-]*\d|\d/g, /"[^"\n]{2,}"|«[^»\n]{2,}»/g]
  for (const re of patterns) {
    for (const m of draft.match(re) ?? []) found.add(m.replace(/[.,;:)]+$/, ''))
  }
  return [...found]
}

// Devuelve la lista de problemas del resultado; vacía si es válido.
function check(draft: string, out: string): string[] {
  const problems: string[] = []
  const heads = SECTIONS.filter(s => new RegExp(`^${s}:`, 'mi').test(out))
  if (!/^objetivo:/mi.test(out)) problems.push('falta la sección "Objetivo:"')
  if (heads.length < 3) problems.push('debe tener al menos 3 secciones con las cabeceras exactas (Rol:, Objetivo:, Contexto:, Instrucciones:, Restricciones:, Formato de salida:)')
  if (/```/.test(out)) problems.push('no uses bloques de código')
  if (/^(aqu[ií]|claro|por supuesto|here|sure)\b/i.test(out.trim())) problems.push('quita el saludo o comentario inicial: solo el prompt')
  if (/hazme todas las preguntas/i.test(out)) problems.push('no incluyas la petición de preguntas')
  if (/no (me )?(hagas|hag[aá]is|plantees|preguntes)[^.\n]{0,25}pregunt|sin (hacer )?pregunt|no (hagas )?pregunt/i.test(out)) problems.push('elimina cualquier restricción que prohíba hacer preguntas o retrasar la respuesta')
  if (out.length < draft.length * 0.9) problems.push('el resultado es más corto que el borrador: no pierdas información')
  if (out.length > Math.max(draft.length * 15, 1800)) problems.push('es demasiado largo: sé más compacto')
  const lost = keyTokens(draft).filter(t => !out.toLowerCase().includes(t.toLowerCase()))
  if (lost.length) problems.push(`se perdieron datos del borrador que deben aparecer tal cual: ${lost.slice(0, 8).join(' | ')}`)
  return problems
}

export const register: Register = on => {
  let isBusy = false

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button
          key="cowboy"
          label="🤠 Cowboy"
          onPress={async () => {
            if (isBusy) return
            const { text } = await $.prompt.read()
            const draft = text.trim()

            if (draft === '') {
              $.ui.toast('🤠 Escribe primero un prompt en el cuadro de texto')
              return
            }

            isBusy = true
            $.ui.toast('🤠 Optimizando el prompt…')

            try {
              let feedback = ''
              let result = ''
              let lastProblems: string[] = []
              let usedModel = ''
              let tries = 0

              // Haiku con hasta 3 intentos; cada fallo vuelve con los problemas concretos.
              // Si ninguno pasa la comprobación, un último intento con Sonnet.
              const attempts = [FAST, FAST, FAST, STRONG]
              for (const model of attempts) {
                tries += 1
                const r = await $.model.complete({
                  model,
                  system: SYSTEM,
                  prompt: `BORRADOR:\n\n${draft}${feedback}`,
                  maxTokens: 2500,
                  timeoutMs: 60000,
                })

                if (!r.isAnswered) {
                  lastProblems = [`sin respuesta (${r.reason})`]
                  continue
                }

                const out = r.text.trim()
                const problems = check(draft, out)

                if (problems.length === 0) {
                  result = out
                  usedModel = model
                  break
                }

                lastProblems = problems
                feedback =
                  `\n\nTu intento anterior tenía estos problemas. Corrígelos todos y devuelve solo el prompt:\n- ${problems.join('\n- ')}\n\nIntento anterior:\n${out}`
              }

              if (result === '') {
                $.ui.toast(`🤠 No se pudo optimizar con calidad (${lastProblems[0] ?? 'error'}). Tu borrador queda intacto`)
                return
              }

              await $.prompt.fill({ text: result + ASK, mode: 'replace' })
              const info = `🤠 Optimizado con ${usedModel} (intento ${tries} de ${attempts.length})`
              $.ui.status(info)
              $.ui.log(info)
              $.ui.toast(`${info}. Revísalo y pulsa Enter`)
            } finally {
              isBusy = false
            }
          }}
        />
      </Box>
    )
  })
}
