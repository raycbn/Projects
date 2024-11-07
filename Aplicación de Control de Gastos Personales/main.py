import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import sqlite3
import matplotlib.pyplot as plt

class ControlGastosApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Control de Gastos Personales")
        self.root.geometry("600x400")
        self.root.resizable(False, False)  # Deshabilitar el cambio de tamaño de la ventana

        # Estilo de ttk
        self.style = ttk.Style()
        self.style.configure("TButton",
                             padding=6,
                             relief="flat",
                             background="#4CAF50",
                             font=("Arial", 12, "bold"),
                             foreground="black")
        self.style.map("TButton",
                       background=[("active", "#45a049")])
        self.style.configure("TLabel", font=("Arial", 10), background="#f4f4f4")
        self.style.configure("TCombobox", font=("Arial", 10), padding=5)
        self.style.configure("TEntry", font=("Arial", 10), padding=5)

        # Crear el marco principal
        self.frame = ttk.Frame(root, padding=20)
        self.frame.pack(fill="both", expand=True)

        # Variables para los campos
        self.tipo_var = tk.StringVar()
        self.categoria_var = tk.StringVar()
        self.cantidad_var = tk.DoubleVar()
        self.descripcion_var = tk.StringVar()
        self.fecha_var = tk.StringVar()

        # Definir los campos del formulario y opciones
        self.form_fields = [
            ("Tipo (gasto/ingreso)", self.tipo_var, ["gasto", "ingreso"]),
            ("Categoría", self.categoria_var, ["alimentación", "entretenimiento", "vivienda", "transporte"]),
            ("Cantidad", self.cantidad_var, None),
            ("Descripción", self.descripcion_var, None),
            ("Fecha (YYYY-MM-DD)", self.fecha_var, None)
        ]

        # Crear formulario de entrada
        self.create_form()

        # Botones de acción
        self.create_buttons()

    def create_form(self):
        for i, (label, variable, values) in enumerate(self.form_fields):
            ttk.Label(self.frame, text=label).grid(row=i, column=0, sticky="w", padx=10, pady=8)
            if values:
                entry = ttk.Combobox(self.frame, textvariable=variable, values=values, state="readonly")
            else:
                entry = ttk.Entry(self.frame, textvariable=variable)
            entry.grid(row=i, column=1, padx=10, pady=8, sticky="ew")

    def create_buttons(self):
        # Botón para agregar una transacción
        self.add_button = ttk.Button(self.frame, text="Agregar Transacción", command=self.add_transaction)
        self.add_button.grid(row=5, column=0, columnspan=2, pady=15, padx=10, sticky="ew")

        # Botón para ver gráfico
        self.view_button = ttk.Button(self.frame, text="Ver Gráfico", command=self.view_graph)
        self.view_button.grid(row=6, column=0, columnspan=2, pady=10, padx=10, sticky="ew")

    def add_transaction(self):
        tipo = self.tipo_var.get()
        categoria = self.categoria_var.get()
        cantidad = self.cantidad_var.get()
        descripcion = self.descripcion_var.get()
        fecha = self.fecha_var.get()

        if not tipo or not categoria or not cantidad or not fecha:
            messagebox.showerror("Error", "Por favor, complete todos los campos.")
            return

        # Conectar a la base de datos y registrar la transacción
        try:
            with sqlite3.connect('gastos_personales.db') as conn:
                cursor = conn.cursor()

                # Insertar la transacción en la base de datos
                cursor.execute(
                    "INSERT INTO transacciones (tipo, cantidad, categoria, descripcion, fecha) VALUES (?, ?, ?, ?, ?)",
                    (tipo, cantidad, categoria, descripcion, fecha))
                conn.commit()

            messagebox.showinfo("Éxito", "Transacción registrada exitosamente.")
            self.clear_form()
        except Exception as e:
            messagebox.showerror("Error", f"Ocurrió un error: {str(e)}")

    def clear_form(self):
        # Limpiar los campos del formulario
        self.tipo_var.set("")
        self.categoria_var.set("")
        self.cantidad_var.set(0.0)
        self.descripcion_var.set("")
        self.fecha_var.set("")

    def view_graph(self):
        # Obtener los datos de la base de datos
        try:
            with sqlite3.connect('gastos_personales.db') as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT categoria, SUM(cantidad) FROM transacciones WHERE tipo = 'gasto' GROUP BY categoria")
                data = cursor.fetchall()

            # Preparar los datos para el gráfico
            categorias = [row[0] for row in data]
            cantidades = [row[1] for row in data]

            # Crear el gráfico
            plt.pie(cantidades, labels=categorias, autopct='%1.1f%%', startangle=90)
            plt.title("Distribución de Gastos")
            plt.axis('equal')  # Para que el gráfico sea circular
            plt.show()

        except Exception as e:
            messagebox.showerror("Error", f"Ocurrió un error al generar el gráfico: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = ControlGastosApp(root)
    root.mainloop()
