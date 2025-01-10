import cv2
import numpy as np
import pandas as pd
import time
import matplotlib.pyplot as plt
import onnxruntime as ort
from collections import deque
import gradio as gr
import os
from huggingface_hub import hf_hub_download

# Model info
REPO_ID = "tech4humans/yolov8s-signature-detector"
FILENAME = "tune/trial_10/weights/best.onnx"
MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")


def download_model():
    """Download the model using Hugging Face Hub"""
    # Ensure model directory exists
    os.makedirs(MODEL_DIR, exist_ok=True)

    try:
        print(f"Downloading model from {REPO_ID}...")
        # Download the model file from Hugging Face Hub
        model_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=FILENAME,
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False,
            force_download=True,
            cache_dir=None,
        )

        # Move the file to the correct location if it's not there already
        if os.path.exists(model_path) and model_path != MODEL_PATH:
            os.rename(model_path, MODEL_PATH)

            # Remove empty directories if they exist
            empty_dir = os.path.join(MODEL_DIR, "tune")
            if os.path.exists(empty_dir):
                import shutil

                shutil.rmtree(empty_dir)

        print("Model downloaded successfully!")
        return MODEL_PATH

    except Exception as e:
        print(f"Error downloading model: {e}")
        raise e


class SignatureDetector:
    def __init__(self, model_path):
        self.model_path = model_path
        self.classes = ["signature"]
        self.input_width = 640
        self.input_height = 640

        # Initialize ONNX Runtime session
        self.session = ort.InferenceSession(
            MODEL_PATH, providers=["CPUExecutionProvider"]
        )

        # Initialize metrics tracking
        self.inference_times = deque(maxlen=50)  # Store last 50 inference times
        self.total_inferences = 0
        self.avg_inference_time = 0

    def update_metrics(self, inference_time):
        self.inference_times.append(inference_time)
        self.total_inferences += 1
        self.avg_inference_time = sum(self.inference_times) / len(self.inference_times)

    def get_metrics(self):
        return {
            "times": list(self.inference_times),
            "total_inferences": self.total_inferences,
            "avg_time": self.avg_inference_time,
        }

    def preprocess(self, img):
        # Convert PIL Image to cv2 format
        img_cv2 = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        # Get image dimensions
        self.img_height, self.img_width = img_cv2.shape[:2]

        # Convert back to RGB for processing
        img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)

        # Resize
        img_resized = cv2.resize(img_rgb, (self.input_width, self.input_height))

        # Normalize and transpose
        image_data = np.array(img_resized) / 255.0
        image_data = np.transpose(image_data, (2, 0, 1))
        image_data = np.expand_dims(image_data, axis=0).astype(np.float32)

        return image_data, img_cv2

    def draw_detections(self, img, box, score, class_id):
        x1, y1, w, h = box
        self.color_palette = np.random.uniform(0, 255, size=(len(self.classes), 3))
        color = self.color_palette[class_id]

        cv2.rectangle(img, (int(x1), int(y1)), (int(x1 + w), int(y1 + h)), color, 2)

        label = f"{self.classes[class_id]}: {score:.2f}"
        (label_width, label_height), _ = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
        )

        label_x = x1
        label_y = y1 - 10 if y1 - 10 > label_height else y1 + 10

        cv2.rectangle(
            img,
            (int(label_x), int(label_y - label_height)),
            (int(label_x + label_width), int(label_y + label_height)),
            color,
            cv2.FILLED,
        )

        cv2.putText(
            img,
            label,
            (int(label_x), int(label_y)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )

    def postprocess(self, input_image, output, conf_thres, iou_thres):
        outputs = np.transpose(np.squeeze(output[0]))
        rows = outputs.shape[0]

        boxes = []
        scores = []
        class_ids = []

        x_factor = self.img_width / self.input_width
        y_factor = self.img_height / self.input_height

        for i in range(rows):
            classes_scores = outputs[i][4:]
            max_score = np.amax(classes_scores)

            if max_score >= conf_thres:
                class_id = np.argmax(classes_scores)
                x, y, w, h = outputs[i][0], outputs[i][1], outputs[i][2], outputs[i][3]

                left = int((x - w / 2) * x_factor)
                top = int((y - h / 2) * y_factor)
                width = int(w * x_factor)
                height = int(h * y_factor)

                class_ids.append(class_id)
                scores.append(max_score)
                boxes.append([left, top, width, height])

        indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thres, iou_thres)

        for i in indices:
            box = boxes[i]
            score = scores[i]
            class_id = class_ids[i]
            self.draw_detections(input_image, box, score, class_id)

        return cv2.cvtColor(input_image, cv2.COLOR_BGR2RGB)

    def detect(self, image, conf_thres=0.25, iou_thres=0.5):
        # Preprocess the image
        img_data, original_image = self.preprocess(image)

        # Run inference
        start_time = time.time()
        outputs = self.session.run(None, {self.session.get_inputs()[0].name: img_data})
        inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Postprocess the results
        output_image = self.postprocess(original_image, outputs, conf_thres, iou_thres)

        self.update_metrics(inference_time)

        return output_image, self.get_metrics()

    def detect_example(self, image, conf_thres=0.25, iou_thres=0.5):
        """Wrapper method for examples that returns only the image"""
        output_image, _ = self.detect(image, conf_thres, iou_thres)
        return output_image


def create_gradio_interface():
    # Download model if it doesn't exist
    if not os.path.exists(MODEL_PATH):
        download_model()

    # Initialize the detector
    detector = SignatureDetector(MODEL_PATH)

    css = """
    .custom-button {
        background-color: #b0ffb8 !important;
        color: black !important;
    }
    .custom-button:hover {
        background-color: #b0ffb8b3 !important;
    }
    .container {
        max-width: 1200px !important;
        margin: auto !important;
    }
    .main-container {
        gap: 20px !important;
    }
    .metrics-container {
        padding: 1.5rem !important;
        border-radius: 0.75rem !important;
        background-color: #1f2937 !important;
        margin: 1rem 0 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    }
    .metrics-title {
        font-size: 1.25rem !important;
        font-weight: 600 !important;
        color: #1f2937 !important;
        margin-bottom: 1rem !important;
    }
    """

    def process_image(image, conf_thres, iou_thres):
        if image is None:
            return None, None, None, None

        output_image, metrics = detector.detect(image, conf_thres, iou_thres)

        # Create plots data
        hist_data = pd.DataFrame({"Tempo (ms)": metrics["times"]})
        line_data = pd.DataFrame(
            {
                "Inferência": range(len(metrics["times"])),
                "Tempo (ms)": metrics["times"],
                "Média": [metrics["avg_time"]] * len(metrics["times"]),
            }
        )

        # Limpar figuras existentes
        plt.close("all")

        # Configuração do estilo dos plots
        plt.style.use("dark_background")

        # Criar figura do histograma
        hist_fig, hist_ax = plt.subplots(figsize=(8, 4), facecolor="#f0f0f5")
        hist_ax.set_facecolor("#f0f0f5")
        hist_data.hist(
            bins=20, ax=hist_ax, color="#4F46E5", alpha=0.7, edgecolor="white"
        )
        hist_ax.set_title(
            "Distribuição dos Tempos de Inferência",
            pad=15,
            fontsize=12,
            color="#1f2937",
        )
        hist_ax.set_xlabel("Tempo (ms)", color="#374151")
        hist_ax.set_ylabel("Frequência", color="#374151")
        hist_ax.tick_params(colors="#4b5563")
        hist_ax.grid(True, linestyle="--", alpha=0.3)

        # Criar figura do gráfico de linha
        line_fig, line_ax = plt.subplots(figsize=(8, 4), facecolor="#f0f0f5")
        line_ax.set_facecolor("#f0f0f5")
        line_data.plot(
            x="Inferência",
            y="Tempo (ms)",
            ax=line_ax,
            color="#4F46E5",
            alpha=0.7,
            label="Tempo",
        )
        line_data.plot(
            x="Inferência",
            y="Média",
            ax=line_ax,
            color="#DC2626",
            linestyle="--",
            label="Média",
        )
        line_ax.set_title(
            "Tempo de Inferência por Execução", pad=15, fontsize=12, color="#1f2937"
        )
        line_ax.set_xlabel("Número da Inferência", color="#374151")
        line_ax.set_ylabel("Tempo (ms)", color="#374151")
        line_ax.tick_params(colors="#4b5563")
        line_ax.grid(True, linestyle="--", alpha=0.3)
        line_ax.legend(frameon=True, facecolor="#f0f0f5", edgecolor="none")

        # Ajustar layout
        hist_fig.tight_layout()
        line_fig.tight_layout()

        # Fechar as figuras para liberar memória
        plt.close(hist_fig)
        plt.close(line_fig)

        return (
            output_image,
            gr.update(
                value=f"Total de Inferências: {metrics['total_inferences']}",
                container=True,
            ),
            hist_fig,
            line_fig,
        )

    with gr.Blocks(
        theme=gr.themes.Soft(
            primary_hue="indigo", secondary_hue="gray", neutral_hue="gray"
        ),
        css=css,
    ) as iface:
        gr.Markdown(
            """
            # Tech4Humans - Detector de Assinaturas
            
            Este sistema utiliza o modelo [**YOLOv8s**](https://huggingface.co/tech4humans/yolov8s-signature-detector), especialmente ajustado para a detecção de assinaturas manuscritas em imagens de documentos. 
           
            Com este detector, é possível identificar assinaturas em documentos digitais com elevada precisão em tempo real, sendo ideal para
            aplicações que envolvem validação, organização e processamento de documentos.
            
            ---
            """
        )

        with gr.Row(equal_height=True, elem_classes="main-container"):
            # Coluna da esquerda para controles e informações
            with gr.Column(scale=1):
                input_image = gr.Image(
                    label="Faça o upload do seu documento", type="pil"
                )

                with gr.Row():
                    clear_btn = gr.ClearButton([input_image], value="Limpar")
                    submit_btn = gr.Button("Detectar", elem_classes="custom-button")

                with gr.Group():
                    confidence_threshold = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.25,
                        step=0.05,
                        label="Limiar de Confiança",
                        info="Ajuste a pontuação mínima de confiança necessária para detecção.",
                    )
                    iou_threshold = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.5,
                        step=0.05,
                        label="Limiar de IoU",
                        info="Ajuste o limiar de Interseção sobre União para Non Maximum Suppression (NMS).",
                    )

            with gr.Column(scale=1):
                output_image = gr.Image(label="Resultados da Detecção")

                with gr.Accordion("Exemplos", open=True):
                    gr.Examples(
                        examples=[
                            ["assets/images/example_{i}.jpg".format(i=i)]
                            for i in range(
                                0, len(os.listdir(os.path.join("assets", "images")))
                            )
                        ],
                        inputs=input_image,
                        outputs=output_image,
                        fn=detector.detect_example,
                        cache_examples=True,
                        cache_mode="lazy",
                    )

        with gr.Row(elem_classes="metrics-container"):
            with gr.Column(scale=1):
                total_inferences = gr.Textbox(
                    label="Total de Inferências", show_copy_button=True, container=True
                )
                hist_plot = gr.Plot(label="Distribuição dos Tempos", container=True)

            with gr.Column(scale=1):
                line_plot = gr.Plot(label="Histórico de Tempos", container=True)

        with gr.Row(elem_classes="container"):

            gr.Markdown(
                """
                ---
                ## Sobre o Projeto

                Este projeto utiliza o modelo YOLOv8s ajustado para detecção de assinaturas manuscritas em imagens de documentos. Ele foi treinado com dados provenientes dos conjuntos [Tobacco800](https://paperswithcode.com/dataset/tobacco-800) e [signatures-xc8up](https://universe.roboflow.com/roboflow-100/signatures-xc8up), passando por processos de pré-processamento e aumentação de dados.

                ### Principais Métricas:
                - **Precisão (Precision):** 94,74%
                - **Revocação (Recall):** 89,72%
                - **mAP@50:** 94,50%
                - **mAP@50-95:** 67,35%
                - **Tempo de Inferência (CPU):** 171,56 ms

                O processo completo de treinamento, ajuste de hiperparâmetros, e avaliação do modelo pode ser consultado em detalhes no repositório abaixo.

                [Leia o README completo no Hugging Face Models](https://huggingface.co/tech4humans/yolov8s-signature-detector)

                ---

                **Desenvolvido por [Tech4Humans](https://www.tech4h.com.br/)** | **Modelo:** [YOLOv8s](https://huggingface.co/tech4humans/yolov8s-signature-detector) | **Datasets:** [Tobacco800](https://paperswithcode.com/dataset/tobacco-800), [signatures-xc8up](https://universe.roboflow.com/roboflow-100/signatures-xc8up)
                """
            )

        clear_btn.add([output_image])

        submit_btn.click(
            fn=process_image,
            inputs=[input_image, confidence_threshold, iou_threshold],
            outputs=[output_image, total_inferences, hist_plot, line_plot],
        )

    return iface


if __name__ == "__main__":
    iface = create_gradio_interface()
    iface.launch()
