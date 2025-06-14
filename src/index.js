// Import necessary hooks from Nebula.js for Qlik Sense extensions
import { useElement, useLayout, useEffect, useApp } from "@nebula.js/stardust";

export default function supernova() {
  return {
    // QAE (Qlik Analytics Engine) configuration
    qae: {
      properties: {
        // Standard Qlik object properties
        showTitles: true,
        title: "",
        subtitle: "",
        footnote: "",
        // Hypercube definition for data handling
        qHyperCubeDef: {
          qDimensions: [], // Array to store dimension definitions
          qMeasures: [], // Array to store measure definitions
          // Initial data fetch configuration
          qInitialDataFetch: [
            {
              qWidth: 10, // Number of columns to fetch
              qHeight: 100, // Number of rows to fetch
            },
          ],
        },
        // Custom properties for LLM configuration
        props: {
          connectionName: "Churn Analytics:Anthropic_Claude35Sonnet_ChurnML", // Default connection
          systemPrompt: "", // System-level instructions for the LLM
          userPrompt: "", // User's query/prompt
          temperature: 0.7, // Controls randomness in responses (0-1)
          topK: 250, // Limits vocabulary to top K tokens
          topP: 1, // Nucleus sampling parameter
          maxTokens: 1000, // Maximum response length
        },
      },
      // Data targets configuration
      data: {
        targets: [
          {
            path: "/qHyperCubeDef", // Path to hypercube definition
            dimensions: {
              min: 0, // Minimum dimensions allowed
              max: 10, // Maximum dimensions allowed
            },
            measures: {
              min: 0, // Minimum measures allowed
              max: 10, // Maximum measures allowed
            },
          },
        ],
      },
    },
    // Extension definition for property panel
    ext: {
      definition: {
        type: "items",
        component: "accordion", // Accordion-style property panel
        items: {
          // Standard data configuration section
          data: {
            uses: "data", // Uses built-in data configuration
          },
          // Custom LLM configuration section
          settings: {
            type: "items",
            label: "LLM Configuration",
            items: {
              // Connection name input field
              connectionName: {
                type: "string",
                label: "Connection Name",
                ref: "props.connectionName", // Reference to property
                defaultValue:
                  "Churn Analytics:Anthropic_Claude35Sonnet_ChurnML",
              },
              // System prompt textarea
              systemPrompt: {
                type: "string",
                component: "textarea", // Multi-line text input
                label: "System Prompt",
                ref: "props.systemPrompt",
                defaultValue: "",
                show: true,
              },
              // User prompt textarea
              userPrompt: {
                type: "string",
                component: "textarea",
                label: "User Prompt",
                ref: "props.userPrompt",
                defaultValue: "",
                show: true,
              },
              // Temperature slider control
              temperature: {
                type: "number",
                component: "slider",
                label: "Temperature",
                ref: "props.temperature",
                min: 0,
                max: 1,
                step: 0.1,
                defaultValue: 0.7,
              },
              // Top K parameter input
              topK: {
                type: "integer",
                label: "Top K",
                ref: "props.topK",
                defaultValue: 250,
                min: 1,
                max: 500,
              },
              // Top P parameter input
              topP: {
                type: "number",
                label: "Top P",
                ref: "props.topP",
                defaultValue: 1,
                min: 0,
                max: 1,
              },
              // Max tokens input
              maxTokens: {
                type: "integer",
                label: "Max Tokens",
                ref: "props.maxTokens",
                defaultValue: 1000,
                min: 100,
                max: 4000,
              },
            },
          },
          // Standard appearance settings
          appearance: {
            uses: "settings", // Uses built-in appearance settings
          },
        },
      },
      // Extension support capabilities
      support: {
        snapshot: true, // Supports snapshots
        export: true, // Supports export
        exportData: false, // Doesn't support data export
      },
    },
    // Main component function
    component() {
      // Get DOM element reference
      const element = useElement();
      // Get layout object with properties and data
      const layout = useLayout();
      // Get Qlik app instance for API calls
      const app = useApp();

      // Effect hook to handle rendering and updates
      useEffect(() => {
        if (!element) return; // Exit if no element

        // Main render function
        const render = () => {
          // Extract properties from layout, with fallback
          const props = layout?.props || {};

          // Start building HTML content with modern container styling
          let content = `
            <div style="
              padding: 24px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              background: #ffffff;
            ">
              <!-- Header section with title and icon -->
              <div style="
                display: flex;
                align-items: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e0e0e0;
              ">
                <span style="font-size: 28px; margin-right: 12px;">🤖</span>
                <h2 style="
                  margin: 0;
                  font-size: 24px;
                  font-weight: 600;
                  color: #1a1a1a;
                ">Dynamic LLM Response</h2>
              </div>
          `;

          // Check if required configuration is missing
          if (!props.connectionName || !props.userPrompt) {
            // Show configuration needed state
            content += `
              <div style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f8f9fa;
                border: 2px dashed #dee2e6;
                border-radius: 12px;
                text-align: center;
                color: #6c757d;
              ">
                <div>
                  <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">🤖</div>
                  <h3 style="margin: 0 0 8px 0; color: #495057;">Configuration Required</h3>
                  <p style="margin: 0; font-size: 14px;">Please set up the connection and prompt in the properties panel</p>
                </div>
              </div>
            `;
          } else {
            // Show working state with functional UI
            content += `
              <!-- Button controls section -->
              <div style="
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
              ">
                <!-- Generate response button -->
                <button id="llmButton" style="
                  padding: 12px 24px;
                  background: #0066cc;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 15px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                  box-shadow: 0 2px 4px rgba(0,102,204,0.2);
                ">
                  <span style="margin-right: 8px;">✨</span>
                  Generate Response
                </button>
                <!-- Clear response button -->
                <button id="clearButton" style="
                  padding: 12px 20px;
                  background: #ffffff;
                  color: #6c757d;
                  border: 1px solid #dee2e6;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 15px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                ">
                  Clear
                </button>
              </div>
              
              <!-- Response display area -->
              <div id="llmResponse" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                white-space: pre-wrap;
                font-size: 15px;
                line-height: 1.6;
                color: #212529;
                position: relative;
              ">
                <!-- Initial placeholder content -->
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                  color: #6c757d;
                ">
                  <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.2;">💭</div>
                    <p style="margin: 0;">Click "Generate Response" to analyze your data with AI</p>
                  </div>
                </div>
              </div>
            `;
          }

          // Close main container
          content += `</div>`;
          // Set the generated HTML content
          element.innerHTML = content;

          // Add event handlers for interactive elements
          const button = element.querySelector("#llmButton");
          const clearButton = element.querySelector("#clearButton");
          const responseDiv = element.querySelector("#llmResponse");

          // Clear button event handler
          if (clearButton && responseDiv) {
            clearButton.onclick = () => {
              // Reset response area to initial state
              responseDiv.innerHTML = `
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                  color: #6c757d;
                ">
                  <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.2;">💭</div>
                    <p style="margin: 0;">Click "Generate Response" to analyze your data with AI</p>
                  </div>
                </div>
              `;
            };
          }

          // Generate button event handler
          if (button && responseDiv) {
            button.onclick = async () => {
              // Disable button during processing
              button.disabled = true;
              button.style.background = "#e0e0e0";
              button.style.cursor = "not-allowed";
              button.innerHTML =
                '<span style="margin-right: 8px;">⏳</span> Generating...';

              // Show loading animation
              responseDiv.innerHTML = `
                <div style="display: flex; align-items: center; color: #6c757d;">
                  <div style="
                    width: 20px;
                    height: 20px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #0066cc;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 12px;
                  "></div>
                  <!-- CSS animation for loading spinner -->
                  <style>
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  </style>
                  Analyzing data and generating response...
                </div>
              `;

              try {
                // Build the complete prompt for the LLM
                let fullPrompt = props.userPrompt || "";
                // Prepend system prompt if provided
                if (props.systemPrompt) {
                  fullPrompt = props.systemPrompt + "\n\n" + fullPrompt;
                }

                // Add data context if hypercube data is available
                if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
                  fullPrompt += "\n\nData Context:\n";
                  const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

                  // Add column headers if available
                  if (
                    layout.qHyperCube.qDimensionInfo?.length ||
                    layout.qHyperCube.qMeasureInfo?.length
                  ) {
                    // Combine dimension and measure titles as headers
                    const headers = [
                      ...layout.qHyperCube.qDimensionInfo.map(
                        (d) => d.qFallbackTitle
                      ),
                      ...layout.qHyperCube.qMeasureInfo.map(
                        (m) => m.qFallbackTitle
                      ),
                    ];
                    fullPrompt += headers.join(", ") + "\n";
                  }

                  // Add data rows to prompt
                  matrix.forEach((row, idx) => {
                    if (idx < 100) {
                      // Limit to first 100 rows to prevent payload bloat
                      fullPrompt +=
                        row
                          .map((cell) => cell.qText || cell.qNum || "") // Extract text or numeric values
                          .join(", ") + "\n";
                    }
                  });

                  // Add indicator if more data exists
                  if (matrix.length > 100) {
                    fullPrompt += `... and ${matrix.length - 100} more rows\n`;
                  }
                }

                // Escape special characters for safe string embedding
                const escapedPrompt = fullPrompt
                  .replace(/\\/g, "\\\\") // Escape backslashes
                  .replace(/'/g, "\\'") // Escape single quotes
                  .replace(/"/g, '\\"') // Escape double quotes
                  .replace(/\n/g, "\\n") // Escape newlines
                  .replace(/\r/g, "\\r") // Escape carriage returns
                  .replace(/\t/g, "\\t"); // Escape tabs

                // Build Qlik expression to call LLM endpoint
                const expression = `endpoints.ScriptEvalStr(
                  '{"RequestType":"endpoint",
                   "endpoint":{
                     "connectionname":"${props.connectionName}",
                     "column":"text",
                     "parameters":{
                       "temperature":"${props.temperature}",
                       "Top K":"${props.topK}",
                       "Top P":"${props.topP}",
                       "max_tokens":"${props.maxTokens}"
                     }}}',
                  '${escapedPrompt}'
                )`;

                // Execute the expression via Qlik's evaluation API
                const response = await app.evaluate({
                  qExpression: expression,
                });

                // Extract response text with fallback
                const responseText =
                  response?.qText || response || "No response received";

                // Display formatted response
                responseDiv.innerHTML = `
                  <div style="position: relative;">
                    <!-- Success indicator badge -->
                    <div style="
                      position: absolute;
                      top: -10px;
                      right: -10px;
                      background: #28a745;
                      color: white;
                      padding: 4px 12px;
                      border-radius: 4px;
                      font-size: 12px;
                      font-weight: 500;
                    ">AI Response</div>
                    <!-- Response text with line break preservation -->
                    <div style="white-space: pre-wrap; word-wrap: break-word;">
                      ${responseText.replace(/\n/g, "<br>")}
                    </div>
                  </div>
                `;
              } catch (err) {
                // Log error for debugging
                console.error("LLM Error:", err);
                // Display user-friendly error message
                responseDiv.innerHTML = `
                  <div style="
                    background: #f8d7da;
                    color: #721c24;
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid #f5c6cb;
                  ">
                    <strong>Error:</strong> ${
                      err.message || "Failed to generate response"
                    }
                  </div>
                `;
              } finally {
                // Re-enable button regardless of success/failure
                button.disabled = false;
                button.style.background = "#0066cc";
                button.style.cursor = "pointer";
                button.innerHTML =
                  '<span style="margin-right: 8px;">✨</span> Generate Response';
              }
            };
          }
        };

        // Execute render function
        render();
      }, [element, layout, app]); // Re-run effect when dependencies change
    },
  };
}
