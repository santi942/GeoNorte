
/* =========================================
   CAMPUS - LOGIN
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const formulario = document.getElementById("formularioLogin");
    const titulo = document.getElementById("tituloFormulario");

    const campoNombre = document.getElementById("nombre");
    const contenedorNombre = document.getElementById("contenedorNombre");

    const campoCorreo = document.getElementById("correo");
    const campoContrasena = document.getElementById("contrasena");

    const opcionesLogin = document.getElementById("opcionesLogin");
    const botonEnviar = document.getElementById("botonEnviar");

    const enlaceRegistro = document.getElementById("enlaceRegistro");
    const textoPregunta = document.getElementById("textoPregunta");
    const enlaceRecuperar = document.getElementById("enlaceRecuperar");

    const mensaje = document.getElementById("mensajeLogin");

    let modoRegistro = false;
    let procesando = false;

    // Mostrar mensajes al usuario.
    function mostrarMensaje(texto) {
        mensaje.textContent = texto;
    }

    // Verificar que la conexión esté configurada.
    function obtenerCliente() {
        if (!clienteSupabase) {
            mostrarMensaje(
                "Configura la URL y la clave pública en SUPABASE.js."
            );
            return null;
        }

        return clienteSupabase;
    }

    // Evitar envíos repetidos.
    function cambiarEstadoBoton(ocupado, texto = "") {
        procesando = ocupado;
        botonEnviar.disabled = ocupado;

        if (ocupado) {
            botonEnviar.textContent = texto || "Procesando...";
        } else {
            botonEnviar.textContent = modoRegistro
                ? "Crear cuenta"
                : "Ingresar";
        }
    }

    // Cambiar entre inicio de sesión y registro.
    enlaceRegistro.addEventListener("click", (evento) => {
        evento.preventDefault();

        modoRegistro = !modoRegistro;
        mostrarMensaje("");

        if (modoRegistro) {
            titulo.textContent = "Crear Cuenta";

            contenedorNombre.style.display = "flex";
            campoNombre.required = true;

            campoContrasena.autocomplete = "new-password";

            opcionesLogin.style.display = "none";

            botonEnviar.textContent = "Crear cuenta";
            textoPregunta.textContent = "¿Ya tienes cuenta?";
            enlaceRegistro.textContent = "Inicia sesión aquí";
        } else {
            titulo.textContent = "Iniciar Sesión";

            contenedorNombre.style.display = "none";
            campoNombre.required = false;
            campoNombre.value = "";

            campoContrasena.autocomplete = "current-password";

            opcionesLogin.style.display = "flex";

            botonEnviar.textContent = "Ingresar";
            textoPregunta.textContent = "¿No tienes cuenta?";
            enlaceRegistro.textContent = "Regístrate aquí";
        }
    });

    // Registrar un usuario o iniciar sesión.
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (procesando) return;

        const supabase = obtenerCliente();

        if (!supabase) return;

        const correo = campoCorreo.value.trim();
        const contrasena = campoContrasena.value;

        mostrarMensaje("");

        cambiarEstadoBoton(true);

        try {

            if (modoRegistro) {

                const nombre = campoNombre.value.trim();

                if (!nombre) {
                    mostrarMensaje("Escribe tu nombre completo.");
                    cambiarEstadoBoton(false);
                    return;
                }

                if (contrasena.length < 6) {
                    mostrarMensaje(
                        "La contraseña debe tener al menos 6 caracteres."
                    );
                    cambiarEstadoBoton(false);
                    return;
                }

                // Crear cuenta en Supabase Auth.
                const { data, error } = await supabase.auth.signUp({
                    email: correo,
                    password: contrasena,
                    options: {
                        data: {
                            nombre: nombre
                        }
                    }
                });

                if (error) throw error;

                // Si Supabase permite entrar inmediatamente.
                if (data.session) {
                    mostrarMensaje("Cuenta creada correctamente.");

                    window.location.href = "MENU.html";
                    return;
                }

                // Si está activada la confirmación por correo.
                mostrarMensaje(
                    "Cuenta creada. Revisa tu correo y confirma el registro antes de iniciar sesión."
                );

                // Regresar al modo de inicio de sesión.
                modoRegistro = false;

                titulo.textContent = "Iniciar Sesión";
                contenedorNombre.style.display = "none";
                campoNombre.required = false;
                campoNombre.value = "";

                campoContrasena.value = "";
                campoContrasena.autocomplete = "current-password";

                opcionesLogin.style.display = "flex";

                botonEnviar.textContent = "Ingresar";
                textoPregunta.textContent = "¿No tienes cuenta?";
                enlaceRegistro.textContent = "Regístrate aquí";

            } else {

                // Iniciar sesión con correo y contraseña.
                const { data, error } =
                    await supabase.auth.signInWithPassword({
                        email: correo,
                        password: contrasena
                    });

                if (error) throw error;

                if (data.session) {
                    mostrarMensaje("Inicio de sesión exitoso.");

                    window.location.href = "MENU.html";
                } else {
                    mostrarMensaje(
                        "No se pudo iniciar sesión. Inténtalo nuevamente."
                    );
                }
            }

        } catch (error) {
            console.error("Error de autenticación:", error);

            mostrarMensaje(traducirError(error));

        } finally {
            cambiarEstadoBoton(false);
        }
    });

    // Recuperar contraseña.
    enlaceRecuperar.addEventListener("click", async (evento) => {
        evento.preventDefault();

        if (procesando) return;

        const supabase = obtenerCliente();

        if (!supabase) return;

        const correo = campoCorreo.value.trim();

        if (!correo) {
            mostrarMensaje(
                "Escribe tu correo electrónico para recuperar la contraseña."
            );
            campoCorreo.focus();
            return;
        }

        mostrarMensaje("Enviando solicitud de recuperación...");

        try {
            const { error } =
                await supabase.auth.resetPasswordForEmail(correo);

            if (error) throw error;

            mostrarMensaje(
                "Si el correo está registrado, recibirás las instrucciones de recuperación. Revisa también la carpeta de spam."
            );

        } catch (error) {
            console.error("Error al recuperar contraseña:", error);

            mostrarMensaje(
                "No se pudo procesar la recuperación. Verifica la configuración de Supabase e inténtalo nuevamente."
            );
        }
    });

    // Mensajes de error más claros.
    function traducirError(error) {
        const codigo = error?.code || "";
        const texto = (error?.message || "").toLowerCase();

        if (
            codigo === "invalid_credentials" ||
            texto.includes("invalid login credentials")
        ) {
            return "Correo o contraseña incorrectos.";
        }

        if (
            codigo === "email_not_confirmed" ||
            texto.includes("email not confirmed")
        ) {
            return "Debes confirmar tu correo antes de iniciar sesión.";
        }

        if (
            codigo === "user_already_exists" ||
            texto.includes("user already registered")
        ) {
            return "No se pudo completar el registro. Comprueba si ya tienes una cuenta con ese correo.";
        }

        if (
            codigo === "weak_password" ||
            texto.includes("password should be")
        ) {
            return "La contraseña no cumple los requisitos de seguridad de Supabase.";
        }

        if (
            texto.includes("rate limit") ||
            texto.includes("too many requests")
        ) {
            return "Has realizado demasiados intentos. Espera un momento e inténtalo de nuevo.";
        }

        return "No se pudo completar la operación. Verifica los datos e inténtalo nuevamente.";
    }

});
