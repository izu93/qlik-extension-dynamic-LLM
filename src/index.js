import {
  useElement,
  useLayout,
  useEffect,
  useState,
  useModel,
} from "@nebula.js/stardust";
import properties from "./object-properties";
import data from "./data";
import ext from "./ext";

/**
 * Main extension entry point - the supernova function
 */
export default function supernova(galaxy) {
  console.log(
    "index.js: Initializing Dynamic LLM extension with galaxy",
    galaxy
  );

  return {
    // Define the extension's data requirements and properties
    qae: {
      properties,
      data,
    },
    ext: ext(galaxy),

    /**
     * Component function that renders the visualization
     */
    component() {
      console.log("index.js: Component function called");

      // Get the DOM element where we'll render the extension
      const element = useElement();
      console.log("index.js: Got element", element);

      // Get the layout data from Qlik
      const layout = useLayout();
      console.log("index.js: Got layout", layout);

      // Get the model for Qlik interactions
      const model = useModel();
      console.log("index.js: Got model", model);

      // State for tracking the extension data
      const [extensionData, setExtensionData] = useState(null);

      // Process layout data when it changes
      useEffect(() => {
        if (layout) {
          console.log("index.js: Processing layout data", layout);

          // Extract properties from layout
          const props = layout.props || {};

          setExtensionData({
            connectionName: props.connectionName || "",
            systemPrompt: props.systemPrompt || "",
            userPrompt: props.userPrompt || "",
            dynamicVariableKey: props.dynamicVariableKey || "",
            dynamicVariableValue: props.dynamicVariableValue || "",
            temperature: props.temperature || 0.7,
            topK: props.topK || 250,
            topP: props.topP || 1,
            maxTokens: props.maxTokens || 1000,
            stopTokens: props.stopTokens || "",
            font: props.font || "Arial",
            fontSize: props.fontSize || 14,
            fontColor: props.fontColor || { color: "#000000" },
          });
        }
      }, [layout]);

      // Render the extension when data changes
      useEffect(() => {
        try {
          console.log("index.js: Rendering extension", extensionData);

          // Clear previous content
          element.innerHTML = "";

          // Create main container
          const container = document.createElement("div");
          container.className = "llm-extension-container";
          element.appendChild(container);

          // Check if we have any meaningful configuration
          const hasConfiguration =
            extensionData &&
            (extensionData.connectionName ||
              extensionData.systemPrompt ||
              extensionData.userPrompt ||
              extensionData.dynamicVariableKey ||
              extensionData.dynamicVariableValue);

          if (!hasConfiguration) {
            // Show simple placeholder like in your target image
            const placeholder = document.createElement("div");
            placeholder.className = "llm-placeholder";
            placeholder.innerHTML = `
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                min-height: 200px;
                color: #666;
                font-family: Arial, sans-serif;
                text-align: center;
                background-color: #fafafa;
                border: 2px dashed #ddd;
                border-radius: 8px;
                padding: 40px 20px;
              ">
                <div style="
                  width: 60px;
                  height: 60px;
                  border-radius: 50%;
                  background-color: #e0e0e0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-bottom: 20px;
                  font-size: 24px;
                ">
                  🤖
                </div>
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">
                  New LLM object
                </div>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px;">
                  Configure connection and prompts to get started
                </div>
                <div style="
                  background-color: #f0f0f0;
                  padding: 8px 16px;
                  border-radius: 4px;
                  font-size: 12px;
                  color: #888;
                  border: 1px solid #ddd;
                ">
                  Natural language response
                </div>
              </div>
            `;
            container.appendChild(placeholder);
            console.log("index.js: Showing placeholder view");
            return;
          }

          // Show full configuration preview when settings are configured
          const containerStyle = {
            padding: "20px",
            fontFamily: extensionData.font,
            fontSize: `${extensionData.fontSize}px`,
            color: extensionData.fontColor.color,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            backgroundColor: "#fff",
          };

          Object.assign(container.style, containerStyle);

          // Title
          const title = document.createElement("h3");
          title.textContent = "Dynamic LLM Extension - Configuration Preview";
          title.style.margin = "0 0 20px 0";
          title.style.color = "#333";
          container.appendChild(title);

          // Connection section
          const connectionSection = document.createElement("div");
          connectionSection.innerHTML = `
            <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
              <h4 style="margin: 0 0 10px 0; color: #555;">Connection Settings</h4>
              <div style="margin-bottom: 8px;">
                <strong>Connection Name:</strong> 
                <span style="background: #fff; padding: 4px 8px; border-radius: 3px; border: 1px solid #ddd;">
                  ${extensionData.connectionName || "Not selected"}
                </span>
              </div>
            </div>
          `;
          container.appendChild(connectionSection);

          // Prompts section
          const promptsSection = document.createElement("div");
          promptsSection.innerHTML = `
            <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
              <h4 style="margin: 0 0 10px 0; color: #555;">Prompts</h4>
              <div style="margin-bottom: 10px;">
                <strong>System Prompt:</strong><br>
                <div style="background: #fff; padding: 8px; border-radius: 3px; border: 1px solid #ddd; min-height: 40px; margin-top: 5px;">
                  ${extensionData.systemPrompt || "No system prompt configured"}
                </div>
              </div>
              <div>
                <strong>User Prompt:</strong><br>
                <div style="background: #fff; padding: 8px; border-radius: 3px; border: 1px solid #ddd; min-height: 60px; margin-top: 5px;">
                  ${extensionData.userPrompt || "No user prompt configured"}
                </div>
              </div>
            </div>
          `;
          container.appendChild(promptsSection);

          // Variables section
          const variablesSection = document.createElement("div");
          variablesSection.innerHTML = `
            <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
              <h4 style="margin: 0 0 10px 0; color: #555;">Dynamic Variables</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <strong>Key:</strong> 
                  <span style="background: #fff; padding: 4px 8px; border-radius: 3px; border: 1px solid #ddd; display: inline-block; margin-left: 5px;">
                    ${extensionData.dynamicVariableKey || "None"}
                  </span>
                </div>
                <div>
                  <strong>Value:</strong> 
                  <span style="background: #fff; padding: 4px 8px; border-radius: 3px; border: 1px solid #ddd; display: inline-block; margin-left: 5px;">
                    ${extensionData.dynamicVariableValue || "None"}
                  </span>
                </div>
              </div>
            </div>
          `;
          container.appendChild(variablesSection);

          // Model parameters section
          const parametersSection = document.createElement("div");
          parametersSection.innerHTML = `
            <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
              <h4 style="margin: 0 0 10px 0; color: #555;">Model Parameters</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div><strong>Temperature:</strong> <span style="color: #0066cc;">${
                  extensionData.temperature
                }</span></div>
                <div><strong>Top K:</strong> <span style="color: #0066cc;">${
                  extensionData.topK
                }</span></div>
                <div><strong>Top P:</strong> <span style="color: #0066cc;">${
                  extensionData.topP
                }</span></div>
                <div><strong>Max Tokens:</strong> <span style="color: #0066cc;">${
                  extensionData.maxTokens
                }</span></div>
              </div>
              ${
                extensionData.stopTokens
                  ? `
                <div style="margin-top: 10px;">
                  <strong>Stop Tokens:</strong> <span style="color: #0066cc;">${extensionData.stopTokens}</span>
                </div>
              `
                  : ""
              }
            </div>
          `;
          container.appendChild(parametersSection);

          // Response placeholder
          const responseSection = document.createElement("div");
          responseSection.innerHTML = `
            <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
              <h4 style="margin: 0 0 10px 0; color: #555;">LLM Response</h4>
              <div style="background: #fff; padding: 20px; border-radius: 3px; border: 1px solid #ddd; min-height: 100px; display: flex; align-items: center; justify-content: center; font-style: italic; color: #666;">
                🤖 Natural language response will appear here once connected to LLM service
              </div>
            </div>
          `;
          container.appendChild(responseSection);

          console.log("index.js: Extension rendered successfully");
        } catch (err) {
          console.error("Error rendering extension:", err);
          element.innerHTML = `
            <div style="color: red; padding: 20px; font-family: Arial, sans-serif;">
              <p>Error rendering extension: ${err.message}</p>
            </div>
          `;
        }
      }, [extensionData]);

      // Cleanup function when component is unmounted
      return () => {
        console.log("index.js: Component cleanup");
        element.innerHTML = "";
      };
    },
  };
}
