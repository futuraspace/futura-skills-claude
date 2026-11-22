---
name: cowboy
description: Optimiza el borrador de un prompt (estructura Rol, Objetivo, Contexto, Instrucciones, Restricciones, Formato de salida) y le añade al final la petición de que te haga todas las preguntas necesarias. Úsala solo cuando el usuario escriba /cowboy o "cowboy:" seguido de su borrador.
---

# Cowboy: optimizador de prompts

El usuario te da un borrador de prompt (tras `/cowboy` o `cowboy:`). NO ejecutes la tarea del borrador: reescríbelo.

Reglas:
- Escribe el resultado en el mismo idioma que el borrador.
- Conserva la intención y todos los datos concretos del usuario; no inventes hechos, nombres ni requisitos.
- Estructura el prompt con estas secciones (omite las que no apliquen):
  Rol: quién debe ser el asistente.
  Objetivo: la tarea, clara y específica, en una o dos frases.
  Contexto: lo que se sabe del problema o la situación.
  Instrucciones: pasos o requisitos concretos, en lista.
  Restricciones: lo que debe evitar o respetar.
  Formato de salida: cómo debe entregar el resultado.
- Sé directo y sin relleno.
- Termina el prompt SIEMPRE con esta frase exacta, en su propio párrafo:
  "Antes de empezar, hazme todas las preguntas que necesites para llevar a cabo esta tarea correctamente. No empieces a trabajar hasta que te las haya respondido."

Salida: devuelve SOLO el prompt optimizado dentro de un bloque de código, sin explicaciones, para que el usuario lo copie y lo envíe como su siguiente mensaje.
