import { useElement, useLayout, useEffect, useApp } from "@nebula.js/stardust";
import objectProperties from "./object-properties";
import extensionDefinition from "./ext";
import dataConfiguration from "./data";

export default function supernova() {
  return {
    qae: {
      properties: objectProperties,
      data: dataConfiguration,
    },
    ext: extensionDefinition,
    component() {
      const element = useElement();
      const layout = useLayout();
      const app = useApp();

      // Enhanced field extraction that handles multiple fields
      const extractAllFieldsFromExpression = (customExpression) => {
        if (!customExpression) return [];

        // Find all GetSelectedCount() and GetPossibleCount() functions
        const fieldMatches = customExpression.match(
          /Get(?:Selected|Possible)Count\s*\(\s*\[?([^\])\s]+)\]?\s*\)/gi
        );

        if (fieldMatches) {
          const fields = fieldMatches
            .map((match) => {
              const fieldMatch = match.match(
                /Get(?:Selected|Possible)Count\s*\(\s*\[?([^\])\s]+)\]?\s*\)/i
              );
              return fieldMatch ? fieldMatch[1].trim() : null;
            })
            .filter((field) => field !== null);
          return fields;
        }

        return [];
      };

      // Alternative validation using hypercube data - fully dynamic based on expression
      const validateUsingHypercubeData = (layout, props) => {
        const customExpression = props.customValidationExpression;
        const customMessage =
          props.customValidationMessage ||
          "Please make the required selections to proceed with AI analysis";

        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return {
            valid: false,
            message:
              "No data available - please add dimensions to the extension",
            details: [],
            mode: "hypercube_validation",
          };
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        // Extract field name from the custom expression dynamically
        let fieldName = extractFieldNameFromExpression(customExpression);

        if (!fieldName) {
          return {
            valid: false,
            message: "Could not extract field name from expression",
            details: [
              {
                label: "Expression Analysis",
                valid: false,
                message: `Unable to parse field name from: ${customExpression}`,
                suggestion:
                  "Use format like GetSelectedCount(FieldName)=1 or GetPossibleCount([FieldName])=1",
              },
            ],
            mode: "hypercube_validation",
          };
        }

        // Look for the specified field in dimensions
        const targetDimIndex = dimensionInfo.findIndex(
          (dim) =>
            dim.qFallbackTitle === fieldName ||
            dim.qFallbackTitle.toLowerCase() === fieldName.toLowerCase()
        );

        if (targetDimIndex === -1) {
          return {
            valid: false,
            message: `Please add '${fieldName}' as a dimension and make a selection`,
            details: [
              {
                label: "Missing Dimension",
                valid: false,
                message: `Field '${fieldName}' not found. Available: ${dimensionInfo
                  .map((d) => d.qFallbackTitle)
                  .join(", ")}`,
                suggestion: `Add '${fieldName}' as a dimension to the extension, or check your expression spelling`,
                fieldName: fieldName, // Keep the field name for error display
              },
            ],
            mode: "hypercube_validation",
          };
        }

        // Check unique values in the target dimension
        const uniqueValues = [
          ...new Set(
            matrix
              .map(
                (row) => row[targetDimIndex]?.qText || row[targetDimIndex]?.qNum
              )
              .filter((val) => val !== null && val !== undefined && val !== "")
          ),
        ];

        const valueCount = uniqueValues.length;

        // Determine if valid based on the expression pattern
        let isValid = false;
        let expectedCount = 1; // default

        // Check if expression specifies =1, >=1, >0, etc.
        if (customExpression.includes("=1")) {
          expectedCount = 1;
          isValid = valueCount === 1;
        } else if (
          customExpression.includes(">=1") ||
          customExpression.includes(">0")
        ) {
          expectedCount = "1 or more";
          isValid = valueCount >= 1;
        } else {
          // Default to exactly 1
          expectedCount = 1;
          isValid = valueCount === 1;
        }

        return {
          valid: isValid,
          message: isValid ? "Selection validation passed" : customMessage,
          details: [
            {
              label: `${fieldName} Selection`,
              valid: isValid,
              message: isValid
                ? `Valid: ${valueCount} value(s) selected from ${fieldName}`
                : `Invalid: ${valueCount} values found in ${fieldName}, expected ${expectedCount}`,
              result: valueCount,
              values: uniqueValues.slice(0, 3),
              dimensionName: dimensionInfo[targetDimIndex]?.qFallbackTitle,
              fieldName: fieldName,
            },
          ],
          mode: "hypercube_validation",
        };
      };

      // Custom expression validation - with fallback to hypercube validation
      const validateCustomExpression = async (layout, props, app) => {
        const customExpression = props.customValidationExpression;
        const customMessage =
          props.customValidationMessage ||
          "Please make the required selections to proceed with AI analysis";

        if (!customExpression || customExpression.trim() === "") {
          return {
            valid: false,
            message: "Custom validation expression not configured",
            details: [],
            mode: "custom_expression",
          };
        }

        try {
          // Evaluate the custom expression with current data state
          const result = await app.evaluate({
            qExpression: customExpression,
          });

          // FIXED: Better result parsing
          let resultValue;

          // Try to get the numeric result first
          if (result && typeof result.qNum === "number") {
            resultValue = result.qNum;
          }
          // Then try text result
          else if (
            result &&
            result.qText !== undefined &&
            result.qText !== null
          ) {
            resultValue = result.qText;
            // Try to parse text as number if it looks like a number
            if (typeof resultValue === "string" && !isNaN(resultValue)) {
              resultValue = parseInt(resultValue);
            }
          }
          // Handle direct result values
          else if (typeof result === "number") {
            resultValue = result;
          } else if (typeof result === "string") {
            resultValue = result;
            if (!isNaN(resultValue)) {
              resultValue = parseInt(resultValue);
            }
          } else {
            resultValue = result;
          }

          // FIXED: Proper validation logic for Qlik expressions
          let isValid = false;

          // For GetPossibleCount/GetSelectedCount expressions, Qlik returns -1 for true, 0 for false
          // regardless of whether it's a simple or complex expression
          if (
            customExpression.includes("GetPossibleCount") ||
            customExpression.includes("GetSelectedCount")
          ) {
            // All Get*Count expressions return -1 for true, 0 for false
            isValid = resultValue === -1;
            console.log(
              "Count expression validation:",
              isValid,
              "(-1 = true in Qlik)"
            );
          } else if (
            customExpression.toLowerCase().includes(" and ") ||
            customExpression.toLowerCase().includes(" or ")
          ) {
            // Other complex expressions
            isValid = resultValue === -1;
            console.log(
              "Complex expression validation:",
              isValid,
              "(-1 = true in Qlik)"
            );
          } else {
            // Simple non-count expressions - check for exact value
            isValid = resultValue === 1 || resultValue === "1";
            console.log("Simple expression validation:", isValid);
          }

          // Extract all fields for better error messaging
          const allFields = extractAllFieldsFromExpression(customExpression);
          const primaryField = allFields.length > 0 ? allFields[0] : null;

          return {
            valid: isValid,
            message: isValid ? "Selection validation passed" : customMessage,
            details: [
              {
                label: "Custom Expression",
                valid: isValid,
                message: isValid
                  ? `Expression result: ${resultValue} (Valid)`
                  : `Expression result: ${resultValue} (Invalid - expected -1 for complex expressions)`,
                expression: customExpression,
                result: resultValue,
                fieldName: primaryField, // Use primary field for error display
                allFields: allFields, // Include all fields for debugging
                suggestion: !isValid
                  ? `Make selections in: ${allFields.join(", ")}`
                  : "",
              },
            ],
            mode: "custom_expression",
          };
        } catch (error) {
          console.error("Validation expression error:", error);
          console.log(
            "Expression evaluation failed, falling back to hypercube validation"
          );
          return validateUsingHypercubeData(layout, props);
        }
      };

      // Fallback validation for when custom validation is disabled
      const validateBasicSelection = (layout) => {
        // When custom validation is disabled, require user to enable it first
        return {
          valid: false,
          message:
            "Please enable custom selection validation and configure validation rules",
          mode: "basic",
          requiresValidationSetup: true,
        };
      };

      // Main validation function
      const validateSelections = async (layout, app) => {
        const props = layout?.props || {};

        // If custom validation is enabled, use custom expression
        if (props.enableCustomValidation) {
          return await validateCustomExpression(layout, props, app);
        } else {
          // Basic validation - just check if data exists
          return validateBasicSelection(layout);
        }
      };

      // Enhanced dynamic info for header - extract field from expression dynamically
      const getDynamicSelectionInfo = (layout, validationResult) => {
        if (!validationResult.valid) {
          return "";
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        if (matrix.length === 0 || dimensionInfo.length === 0) {
          return "";
        }

        let infoStrings = [];

        // If we have validation details with field info, use that
        if (
          validationResult.details &&
          validationResult.details[0]?.fieldName
        ) {
          const fieldName = validationResult.details[0].fieldName;
          const dimIndex = dimensionInfo.findIndex(
            (dim) =>
              dim.qFallbackTitle === fieldName ||
              dim.qFallbackTitle.toLowerCase() === fieldName.toLowerCase()
          );

          if (dimIndex !== -1) {
            const value =
              matrix[0][dimIndex]?.qText || matrix[0][dimIndex]?.qNum;
            if (value) {
              infoStrings.push(`${fieldName}: ${value}`);
            }
          }
        } else {
          // Fallback: try to find AccountID or similar
          const accountIdIndex = dimensionInfo.findIndex(
            (dim) =>
              dim.qFallbackTitle.toLowerCase().includes("account") ||
              dim.qFallbackTitle === "AccountID"
          );

          if (accountIdIndex !== -1) {
            const accountValue =
              matrix[0][accountIdIndex]?.qText ||
              matrix[0][accountIdIndex]?.qNum;
            if (accountValue) {
              infoStrings.push(`Account: ${accountValue}`);
            }
          }
        }

        // Look for Risk/Churn prediction (optional secondary info)
        const riskIndex = dimensionInfo.findIndex((dim) => {
          const title = dim.qFallbackTitle.toLowerCase();
          return (
            title.includes("risk") ||
            title.includes("churn") ||
            title.includes("predict")
          );
        });

        if (riskIndex !== -1) {
          const riskValue =
            matrix[0][riskIndex]?.qText || matrix[0][riskIndex]?.qNum;
          if (riskValue) {
            infoStrings.push(`Risk: ${riskValue}`);
          }
        }

        return infoStrings.join(" | ");
      };

      // Enhanced dynamic field replacement function - uses saved field mappings
      const replaceDynamicFields = (promptText, layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return promptText;
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];
        const measureInfo = layout.qHyperCube.qMeasureInfo || [];
        const props = layout?.props || {};

        // Use saved field mappings if available
        const savedMappings = props.fieldMappings || [];

        if (savedMappings.length > 0) {
          // Use saved mappings for precise field replacement
          let replacedPrompt = promptText;

          savedMappings.forEach((mapping) => {
            if (mapping.mappedField && mapping.placeholder) {
              // Find the mapped field in dimensions or measures
              let fieldValue = "";

              // Check dimensions
              const dimIndex = dimensionInfo.findIndex(
                (dim) => dim.qFallbackTitle === mapping.mappedField
              );

              if (dimIndex !== -1) {
                const values = matrix
                  .map(
                    (row) => row[dimIndex]?.qText || row[dimIndex]?.qNum || ""
                  )
                  .filter((v) => v !== "");
                const uniqueValues = [...new Set(values)];
                fieldValue = uniqueValues.slice(0, 5).join(", ");
              } else {
                // Check measures
                const measureIndex = measureInfo.findIndex(
                  (measure) => measure.qFallbackTitle === mapping.mappedField
                );

                if (measureIndex !== -1) {
                  const dimCount = dimensionInfo.length;
                  const values = matrix.map((row) => {
                    const val =
                      row[dimCount + measureIndex]?.qNum ||
                      row[dimCount + measureIndex]?.qText ||
                      0;
                    return parseFloat(val) || 0;
                  });
                  fieldValue = values
                    .slice(0, 5)
                    .map((v) => v.toString())
                    .join(", ");
                }
              }

              // Replace the placeholder with actual field value
              if (fieldValue) {
                const placeholderRegex = new RegExp(
                  mapping.placeholder.replace(/[{}]/g, "\\$&"),
                  "g"
                );
                replacedPrompt = replacedPrompt.replace(
                  placeholderRegex,
                  fieldValue
                );
              }
            }
          });

          return replacedPrompt;
        }

        // Fallback to automatic field detection (original behavior)
        const fieldMap = {};

        // Add dimensions
        dimensionInfo.forEach((dim, index) => {
          const fieldName = dim.qFallbackTitle.toLowerCase();
          const values = matrix
            .map((row) => row[index]?.qText || row[index]?.qNum || "")
            .filter((v) => v !== "");
          const uniqueValues = [...new Set(values)];
          fieldMap[fieldName] = uniqueValues.slice(0, 5).join(", ");
        });

        // Add measures
        measureInfo.forEach((measure, index) => {
          const fieldName = measure.qFallbackTitle.toLowerCase();
          const dimCount = dimensionInfo.length;
          const values = matrix.map((row) => {
            const val =
              row[dimCount + index]?.qNum || row[dimCount + index]?.qText || 0;
            return parseFloat(val) || 0;
          });
          fieldMap[fieldName] = values
            .slice(0, 5)
            .map((v) => v.toString())
            .join(", ");
        });

        // Replace field placeholders - support both {field} and {{field}}
        let replacedPrompt = promptText;

        Object.keys(fieldMap).forEach((fieldName) => {
          const placeholder = `{${fieldName}}`;
          const placeholderDouble = `{{${fieldName}}}`;
          const placeholderUpper = `{${fieldName.toUpperCase()}}`;
          const placeholderDoubleUpper = `{{${fieldName.toUpperCase()}}}`;

          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholder, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderDouble, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderUpper, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderDoubleUpper, "g"),
            fieldMap[fieldName]
          );
        });

        return replacedPrompt;
      };

      // Validation error display
      const generateValidationErrorHTML = (validationResult, props) => {
        const responseStyle = `
    background: ${props.responseBackgroundColor || "#f8f9fa"};
    color: ${props.responseTextColor || "#212529"};
    border: 1px solid ${props.responseBorderColor || "#e9ecef"};
    border-radius: ${props.borderRadius || 8}px;
    padding: 16px;
    font-size: ${props.fontSize || 14}px;
    text-align: ${props.textAlignment || "left"};
    line-height: 1.5;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  `;

        // Get all fields from validation details
        const getAllFieldsFromValidation = (validationResult) => {
          if (
            validationResult.details &&
            validationResult.details[0]?.allFields
          ) {
            return validationResult.details[0].allFields;
          }
          return [];
        };

        if (validationResult.mode === "custom_expression") {
          const allFields = getAllFieldsFromValidation(validationResult);

          return `
      <div style="
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        ${responseStyle}
        text-align: center;
        min-height: 150px;
        max-height: 350px;
        border-color: #ffeaa7;
        background: #fff3cd;
        color: #856404;
      ">
        <div style="max-width: 450px; padding: 20px;">
          ${
            allFields.length > 0
              ? `
            <div style="font-size: 13px; line-height: 1.4;">
              <strong>💡 Make selections in:</strong> ${allFields.join(", ")}
            </div>
          `
              : `
            <div style="font-size: 13px; line-height: 1.4;">
              <strong>💡 Make the required selections to proceed</strong>
            </div>
          `
          }
        </div>
      </div>
    `;
        }

        // For hypercube validation errors
        if (validationResult.mode === "hypercube_validation") {
          const allFields = getAllFieldsFromValidation(validationResult);

          return `
      <div style="
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        ${responseStyle}
        text-align: center;
        min-height: 150px;
        max-height: 350px;
        border-color: #ffeaa7;
        background: #fff3cd;
        color: #856404;
      ">
        <div style="max-width: 450px; padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Selection Required</h3>
          
          <div style="
            background: rgba(133, 100, 4, 0.1);
            border-radius: 8px;
            padding: 12px;
            margin: 12px 0;
            text-align: left;
          ">
            <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">📊 Field Status</div>
            ${
              validationResult.details && validationResult.details[0]
                ? `
              <div style="font-size: 11px;">
                <strong>Field:</strong> ${
                  validationResult.details[0].fieldName || "Unknown"
                }<br>
                <strong>Status:</strong> ${
                  validationResult.details[0].message || "Selection needed"
                }
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
        }

        // Basic validation error for when custom validation is disabled
        if (validationResult.requiresValidationSetup) {
          return `
      <div style="
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        ${responseStyle}
        text-align: center;
        min-height: 150px;
        max-height: 350px;
        border-color: #ffeaa7;
        background: #fff3cd;
        color: #856404;
      ">
        <div style="max-width: 400px; padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚙️</div>
          <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Validation Setup Required</h3>
          <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
            Please enable custom selection validation and configure validation rules to use AI analysis
          </p>
          
          <div style="
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 8px;
            padding: 12px;
            margin-top: 12px;
            font-size: 11px;
            color: #1565c0;
            text-align: left;
            line-height: 1.3;
          ">
            <div style="font-weight: 600; margin-bottom: 6px;">💡 Setup steps:</div>
            <div>
              1. Check "Enable Custom Selection Validation"<br>
              2. Add validation expression (e.g., GetPossibleCount(AccountID)=1)<br>
              3. Configure custom error message<br>
              4. Save and make your selections to enable AI analysis
            </div>
          </div>
        </div>
      </div>
    `;
        }

        // Default fallback error
        return `
    <div style="
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      ${responseStyle}
      text-align: center;
      min-height: 150px;
      max-height: 350px;
      border-color: #ffeaa7;
      background: #fff3cd;
      color: #856404;
    ">
      <div style="max-width: 350px; padding: 20px;">
        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
        <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Selection Required</h3>
        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
          ${
            validationResult.message ||
            "Please make the required selections to proceed with AI analysis"
          }
        </p>
      </div>
    </div>
  `;
      };

      // Simple placeholder detection for {{fieldName}} syntax only
      function detectPlaceholdersInPrompts(systemPrompt, userPrompt) {
        const allText = (systemPrompt || "") + " " + (userPrompt || "");

        // Only detect traditional {{fieldName}} placeholders
        const traditionalMatches = [...allText.matchAll(/\{\{([^}]+)\}\}/g)];
        const detectedFields = traditionalMatches.map((match) => ({
          placeholder: match[0], // Full {{fieldName}}
          fieldName: match[1].trim(), // Just fieldName
          position: match.index,
          source:
            systemPrompt && systemPrompt.includes(match[0]) ? "system" : "user",
          detectionMethod: "traditional",
          autoMappable: true,
        }));

        return detectedFields;
      }

      // Get available fields from current layout
      function getAvailableFields(layout) {
        console.log("🔍 getAvailableFields called with layout:", layout);
        const dimensions = layout?.qHyperCube?.qDimensionInfo || [];
        const measures = layout?.qHyperCube?.qMeasureInfo || [];

        console.log("🔍 Raw dimensions:", dimensions);
        console.log("🔍 Raw measures:", measures);

        const result = {
          dimensions: dimensions.map((dim) => {
            // Use the actual field name from the expression, not the label
            const actualFieldName =
              dim.qGroupFieldDefs?.[0] || dim.qFallbackTitle;
            const displayName = dim.qFallbackTitle;

            console.log(
              `Dimension: "${displayName}" → actual field: "${actualFieldName}"`
            );

            return {
              name: actualFieldName, // Use actual field name for LLM
              displayName: displayName, // Keep display name for UI
              type: "dimension",
              expression: actualFieldName,
            };
          }),
          measures: measures.map((measure) => {
            // For measures, extract the actual field name from the expression
            const expression = measure.qDef?.qDef || measure.qFallbackTitle;
            const displayName = measure.qFallbackTitle;

            // Try to extract field name from expressions like Sum([Field Name])
            let actualFieldName = expression;
            const fieldMatch = expression.match(/\[([^\]]+)\]/);
            if (fieldMatch) {
              actualFieldName = fieldMatch[1];
            } else {
              // If no brackets, try to extract from common aggregation functions
              const aggMatch = expression.match(
                /(?:sum|avg|count|max|min|total)\s*\(\s*([^)]+)\s*\)/i
              );
              if (aggMatch) {
                actualFieldName = aggMatch[1].replace(/['"]/g, "").trim();
              }
            }

            console.log(
              `Measure: "${displayName}" → expression: "${expression}" → actual field: "${actualFieldName}"`
            );

            return {
              name: actualFieldName, // Use actual field name for LLM
              displayName: displayName, // Keep display name for UI
              type: "measure",
              expression: expression,
            };
          }),
        };

        console.log("🔍 Processed result with actual field names:", result);
        return result;
      }

      // Enhanced field matching algorithm that works with intelligent detection
      function suggestFieldMappings(detectedFields, availableFields) {
        const suggestions = [];

        detectedFields.forEach((detected) => {
          const fieldName = detected.fieldName.toLowerCase();

          // For intelligent detection, we already know the field exists
          if (detected.detectionMethod === "intelligent") {
            // Find the exact field match
            const exactMatch = [
              ...availableFields.dimensions,
              ...availableFields.measures,
            ].find((field) => field.name.toLowerCase() === fieldName);

            suggestions.push({
              placeholder: detected.placeholder,
              fieldName: detected.fieldName,
              source: detected.source,
              suggestedField: exactMatch,
              confidence: detected.confidence || 100, // Use pre-calculated confidence
              mappedField: exactMatch ? exactMatch.name : null, // Auto-map intelligent detections
              detectionMethod: detected.detectionMethod,
              suggestedReplacement: detected.suggestedReplacement,
              autoMappable: detected.autoMappable,
              keepAsText: false, // Option to keep as normal text
            });
            return;
          }

          // Traditional matching for {{}} placeholders
          let bestMatch = null;
          let matchScore = 0;

          [...availableFields.dimensions, ...availableFields.measures].forEach(
            (available) => {
              const availableName = available.name.toLowerCase();

              // Exact match
              if (availableName === fieldName) {
                bestMatch = available;
                matchScore = 100;
              }
              // Contains match
              else if (matchScore < 80 && availableName.includes(fieldName)) {
                bestMatch = available;
                matchScore = 80;
              }
              // Starts with match
              else if (matchScore < 60 && availableName.startsWith(fieldName)) {
                bestMatch = available;
                matchScore = 60;
              }
              // Similar words
              else if (
                matchScore < 40 &&
                fieldName.includes(availableName.split(" ")[0])
              ) {
                bestMatch = available;
                matchScore = 40;
              }
            }
          );

          suggestions.push({
            placeholder: detected.placeholder,
            fieldName: detected.fieldName,
            source: detected.source,
            suggestedField: bestMatch,
            confidence: matchScore,
            mappedField: null, // Will be set by user or auto-mapping
            detectionMethod: detected.detectionMethod || "traditional",
            autoMappable: true,
            keepAsText: false,
          });
        });

        return suggestions;
      }

      // Update field detection display
      function updateFieldDetectionDisplay(systemPrompt, userPrompt) {
        const detectedFields = detectPlaceholdersInPrompts(
          systemPrompt,
          userPrompt
        );
        const availableFields = getAvailableFields(layout);
        const suggestions = suggestFieldMappings(
          detectedFields,
          availableFields
        );

        // Update statistics
        updateFieldStats(detectedFields, suggestions);

        // Update detected fields list
        updateDetectedFieldsList(suggestions);

        // Update available fields display
        updateAvailableFieldsDisplay(availableFields);

        return suggestions;
      }

      function updateFieldStats(detectedFields, suggestions) {
        const statsContainer = document.getElementById("smartMappingStats");
        if (!statsContainer) return;

        const totalDetected = detectedFields.length;
        const actuallyMapped = suggestions.filter((s) => s.mappedField).length;
        const autoSuggested = suggestions.filter(
          (s) => s.confidence >= 80 && s.suggestedField
        ).length;
        const needMapping = totalDetected - actuallyMapped;

        statsContainer.innerHTML = `
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${totalDetected}</div>
            <div class="smart-mapping-stat-label">Fields Detected</div>
          </div>
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${actuallyMapped}</div>
            <div class="smart-mapping-stat-label">Mapped</div>
          </div>
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${needMapping}</div>
            <div class="smart-mapping-stat-label">Need Mapping</div>
          </div>
        `;
      }

      function updateDetectedFieldsList(suggestions) {
        const fieldsContainer = document.getElementById(
          "smartMappingFieldsList"
        );
        if (!fieldsContainer) return;

        if (suggestions.length === 0) {
          fieldsContainer.innerHTML = `
            <div style="text-align: center; color: #6c757d; padding: 20px;">
              <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
              <div style="font-size: 14px; margin-bottom: 4px;">No field placeholders detected</div>
              <div style="font-size: 11px; opacity: 0.7;">Add {{fieldName}} placeholders to your prompts</div>
            </div>
          `;
          return;
        }

        const fieldsHTML = suggestions
          .map((suggestion, index) => {
            const mappedField =
              suggestion.mappedField || suggestion.suggestedField?.name || "";
            const isManuallyMapped =
              suggestion.mappedField &&
              suggestion.mappedField !== suggestion.suggestedField?.name;
            const isMapped =
              suggestion.mappedField ||
              (suggestion.confidence >= 80 && suggestion.suggestedField);

            const confidenceColor =
              suggestion.confidence >= 80
                ? "#28a745"
                : suggestion.confidence >= 60
                ? "#ffc107"
                : "#dc3545";
            const confidenceIcon =
              suggestion.confidence >= 80
                ? "✅"
                : suggestion.confidence >= 60
                ? "⚠️"
                : "❌";

            return `
            <div class="smart-mapping-detected-field" style="
              background: white;
              border: 1px solid ${isMapped ? "#28a745" : "#e0e0e0"};
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 8px;
              transition: all 0.2s ease;
              width: 100%;
              box-sizing: border-box;
              overflow: hidden;
            ">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; font-size: 12px; color: #495057; margin-bottom: 4px;">
                    ${suggestion.placeholder}
                    <span style="
                      background: ${
                        suggestion.source === "system" ? "#e3f2fd" : "#fff3e0"
                      };
                      color: ${
                        suggestion.source === "system" ? "#1565c0" : "#ef6c00"
                      };
                      padding: 2px 6px;
                      border-radius: 10px;
                      font-size: 9px;
                      margin-left: 6px;
                    ">${suggestion.source}</span>
                    ${
                      suggestion.detectionMethod === "intelligent"
                        ? '<span style="background: #e8f5e8; color: #2e7d32; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-left: 4px;">🧠 smart</span>'
                        : '<span style="background: #f0f0f0; color: #6c757d; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-left: 4px;">{{}} syntax</span>'
                    }
                    ${
                      isManuallyMapped
                        ? '<span style="background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-left: 4px;">manual</span>'
                        : ""
                    }
                  </div>
                  <div style="font-size: 10px; color: #6c757d;">
                    ${
                      suggestion.detectionMethod === "intelligent"
                        ? `Smart detection: Found "${
                            suggestion.fieldName
                          }" field → ${
                            suggestion.suggestedReplacement ||
                            suggestion.placeholder
                          }`
                        : suggestion.suggestedField
                        ? `Auto-suggested: ${suggestion.suggestedField.name} (${suggestion.suggestedField.type})`
                        : "No auto-mapping suggestion"
                    }
                  </div>
                </div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 10px;
                  color: ${confidenceColor};
                  font-weight: 600;
                ">
                  <span>${confidenceIcon}</span>
                  <span>${suggestion.confidence}%</span>
                </div>
              </div>
              
              <!-- Interactive Mapping Section -->
              <div style="border-top: 1px solid #f0f0f0; padding-top: 8px;">
                ${
                  suggestion.detectionMethod === "intelligent"
                    ? `
                  <!-- Smart Detection Options -->
                  <div style="margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #6c757d; font-weight: 600; margin-bottom: 4px;">Action:</div>
                    <div style="display: flex; gap: 6px;">
                      <button 
                        onclick="acceptFieldMapping(${index})"
                        style="
                          flex: 1;
                          background: ${
                            suggestion.mappedField ? "#28a745" : "#007bff"
                          };
                          color: white;
                          border: none;
                          padding: 6px 8px;
                          border-radius: 4px;
                          font-size: 10px;
                          cursor: pointer;
                          font-weight: 500;
                        "
                        title="Map to ${suggestion.fieldName} field"
                      >
                        ${
                          suggestion.mappedField
                            ? "✓ Mapped to Field"
                            : "🔗 Map to Field"
                        }
                      </button>
                      <button 
                        onclick="keepAsText(${index})"
                        style="
                          flex: 1;
                          background: ${
                            suggestion.keepAsText ? "#6c757d" : "#f8f9fa"
                          };
                          color: ${suggestion.keepAsText ? "white" : "#6c757d"};
                          border: 1px solid #dee2e6;
                          padding: 6px 8px;
                          border-radius: 4px;
                          font-size: 10px;
                          cursor: pointer;
                          font-weight: 500;
                        "
                        title="Keep as normal text"
                      >
                        ${
                          suggestion.keepAsText
                            ? "✓ Keep as Text"
                            : "📝 Keep as Text"
                        }
                      </button>
                    </div>
                  </div>
                  `
                    : ""
                }
                
                <div style="display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box;">
                  <span style="font-size: 10px; color: #6c757d; font-weight: 600; flex-shrink: 0; white-space: nowrap;">
                    ${
                      suggestion.detectionMethod === "intelligent"
                        ? "Override:"
                        : "Map to:"
                    }
                  </span>
                  <select 
                    id="fieldMapping_${index}" 
                    class="smart-mapping-field-selector"
                    onchange="handleFieldMappingChange(${index}, this.value)"
                    style="
                      flex: 1;
                      min-width: 0;
                      padding: 4px 8px;
                      border: 1px solid #ddd;
                      border-radius: 4px;
                      font-size: 11px;
                      background: white;
                      cursor: pointer;
                      max-width: calc(100% - 80px);
                      ${
                        suggestion.detectionMethod === "intelligent"
                          ? "opacity: 0.7;"
                          : ""
                      }
                    "
                  >
                    <option value="">-- Select Field --</option>
                    ${getFieldOptionsHTML(mappedField)}
                  </select>
                  
                  ${
                    mappedField
                      ? `
                    <button 
                      onclick="clearFieldMapping(${index})"
                      style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 4px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                      "
                      title="Clear mapping"
                    >✕</button>
                  `
                      : ""
                  }
                </div>
                
                ${
                  mappedField
                    ? `
                  <div style="
                    margin-top: 6px;
                    padding: 6px 8px;
                    background: #e8f5e8;
                    border: 1px solid #c3e6c3;
                    border-radius: 4px;
                    font-size: 10px;
                    color: #2e7d32;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                  ">
                    <span>✓</span>
                    <span>Mapped to: <strong>${mappedField}</strong></span>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("");

        fieldsContainer.innerHTML = fieldsHTML;
      }

      // Generate field options HTML for dropdowns
      function getFieldOptionsHTML(selectedField = "") {
        const availableFields = getAvailableFields(layout);
        let optionsHTML = "";

        // Add dimension options
        if (availableFields.dimensions.length > 0) {
          optionsHTML += '<optgroup label="📊 Dimensions">';
          availableFields.dimensions.forEach((dim) => {
            const selected = selectedField === dim.name ? "selected" : "";
            optionsHTML += `<option value="${dim.name}" ${selected}>${dim.name}</option>`;
          });
          optionsHTML += "</optgroup>";
        }

        // Add measure options
        if (availableFields.measures.length > 0) {
          optionsHTML += '<optgroup label="📈 Measures">';
          availableFields.measures.forEach((measure) => {
            const selected = selectedField === measure.name ? "selected" : "";
            optionsHTML += `<option value="${measure.name}" ${selected}>${measure.name}</option>`;
          });
          optionsHTML += "</optgroup>";
        }

        return optionsHTML;
      }

      // Handle field mapping changes
      window.handleFieldMappingChange = function (index, selectedField) {
        if (index >= 0 && index < currentFieldSuggestions.length) {
          // Update the mapping
          currentFieldSuggestions[index].mappedField = selectedField || null;

          // Update statistics
          updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);

          // Update validation status
          updateMappingValidation();
        }
      };

      // Clear field mapping
      window.clearFieldMapping = function (index) {
        if (index >= 0 && index < currentFieldSuggestions.length) {
          currentFieldSuggestions[index].mappedField = null;
          currentFieldSuggestions[index].keepAsText = false;

          // Refresh the display
          updateDetectedFieldsList(currentFieldSuggestions);
          updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);
          updateMappingValidation();
        }
      };

      // Accept intelligent field mapping
      window.acceptFieldMapping = function (index) {
        if (index >= 0 && index < currentFieldSuggestions.length) {
          const suggestion = currentFieldSuggestions[index];
          if (suggestion.suggestedField) {
            suggestion.mappedField = suggestion.suggestedField.name;
            suggestion.keepAsText = false;

            // Refresh the display
            updateDetectedFieldsList(currentFieldSuggestions);
            updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);
            updateMappingValidation();
          }
        }
      };

      // Keep field as normal text (don't map)
      window.keepAsText = function (index) {
        if (index >= 0 && index < currentFieldSuggestions.length) {
          currentFieldSuggestions[index].keepAsText = true;
          currentFieldSuggestions[index].mappedField = null;

          // Refresh the display
          updateDetectedFieldsList(currentFieldSuggestions);
          updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);
          updateMappingValidation();
        }
      };

      // FIXED: Update mapping validation status using activeMappings
      function updateMappingValidation() {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (!validationDiv) return;

        // Use activeMappings for validation, not currentFieldSuggestions
        const totalMappings = activeMappings.length;
        const systemPrompt = document.getElementById("smartMappingSystemPrompt")?.value || "";
        const userPrompt = document.getElementById("smartMappingUserPrompt")?.value || "";
        const allPromptText = systemPrompt + " " + userPrompt;
        
        // Count total placeholders in prompts
        const placeholderMatches = allPromptText.match(/\{\{[^}]+\}\}/g) || [];
        const totalFieldsDetected = placeholderMatches.length;
        const needMappingCount = Math.max(0, totalFieldsDetected - totalMappings);

        console.log("🔍 Validation status:", {
          totalFieldsDetected,
          totalMappings,
          needMappingCount,
          activeMappings: activeMappings.length
        });

        if (totalFieldsDetected === 0) {
          validationDiv.innerHTML = "Add field references to your prompts (use {{field}} syntax) for smart mapping";
          validationDiv.style.color = "#6c757d";
        } else if (totalMappings === 0) {
          validationDiv.innerHTML = `⚠️ ${totalFieldsDetected} fields detected but no mappings created`;
          validationDiv.style.color = "#ffc107";
        } else if (needMappingCount > 0) {
          validationDiv.innerHTML = `⚠️ ${totalMappings}/${totalFieldsDetected} fields mapped - ${needMappingCount} remaining`;
          validationDiv.style.color = "#ffc107";
        } else {
          validationDiv.innerHTML = `✅ All ${totalFieldsDetected} fields mapped and ready to save`;
          validationDiv.style.color = "#28a745";
        }
      }

      function updateAvailableFieldsDisplay(availableFields) {
        const dimensionsContainer = document.getElementById(
          "smartMappingDimensions"
        );
        const measuresContainer = document.getElementById(
          "smartMappingMeasures"
        );

        if (dimensionsContainer) {
          if (availableFields.dimensions.length === 0) {
            dimensionsContainer.innerHTML = `
              <div style="
                color: #6c757d;
                font-size: 11px;
                padding: 8px;
                text-align: center;
                background: #f8f9fa;
                border-radius: 6px;
              ">No dimensions available - add dimensions to the extension</div>
            `;
          } else {
            dimensionsContainer.innerHTML = availableFields.dimensions
              .map(
                (dim) => `
              <div class="smart-mapping-field-tag dimension" 
                   data-field="${dim.name}" 
                   data-type="dimension"
                   title="Field: ${dim.name}${
                  dim.displayName !== dim.name
                    ? "\nLabel: " + dim.displayName
                    : ""
                }">
                ${dim.displayName || dim.name}
                ${
                  dim.displayName !== dim.name
                    ? `<br><small style="opacity: 0.7;">${dim.name}</small>`
                    : ""
                }
              </div>
            `
              )
              .join("");
          }
        }

        if (measuresContainer) {
          if (availableFields.measures.length === 0) {
            measuresContainer.innerHTML = `
              <div style="
                color: #6c757d;
                font-size: 11px;
                padding: 8px;
                text-align: center;
                background: #f8f9fa;
                border-radius: 6px;
              ">No measures available - add measures to the extension</div>
            `;
          } else {
            measuresContainer.innerHTML = availableFields.measures
              .map(
                (measure) => `
              <div class="smart-mapping-field-tag measure" 
                   data-field="${measure.name}" 
                   data-type="measure"
                   title="Field: ${measure.name}${
                  measure.displayName !== measure.name
                    ? "\nLabel: " + measure.displayName
                    : ""
                }">
                ${measure.displayName || measure.name}
                ${
                  measure.displayName !== measure.name
                    ? `<br><small style="opacity: 0.7;">${measure.name}</small>`
                    : ""
                }
              </div>
            `
              )
              .join("");
          }
        }
      }

      // Store current suggestions globally for access by other functions
      let currentFieldSuggestions = [];

      // Global state for Select Mode workflow
      let currentMappingMode = "select";
      let activeMappings = [];
      let selectedText = null;
      let selectedTextInfo = null;

      // ===== SELECT MODE WORKFLOW FUNCTIONS =====

      function setMappingMode(mode) {
        currentMappingMode = mode;

        // Update mode buttons
        document
          .getElementById("selectModeBtn")
          ?.classList.toggle("active", mode === "select");
        document
          .getElementById("dragModeBtn")
          ?.classList.toggle("active", mode === "drag");

        // Update textarea classes
        const textareas = document.querySelectorAll(".smart-mapping-textarea");
        textareas.forEach((textarea) => {
          textarea.classList.toggle("select-mode", mode === "select");
        });

        // Update mode indicators
        const selectText =
          mode === "select"
            ? "Select text, then drag fields"
            : "Drag fields to create {{placeholders}}";
        document.getElementById("systemPromptModeText").textContent =
          selectText;
        document.getElementById("userPromptModeText").textContent = selectText;

        // Update validation message
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.textContent =
            mode === "select"
              ? "Ready to create field mappings - select text and drag fields"
              : "Ready to create field mappings - drag fields to prompts";
        }
      }

      // Track click timing to prevent rapid clicks
      let lastClickTime = 0;
      let clickCount = 0;

      function preventFastClicks(event) {
        const now = Date.now();
        if (now - lastClickTime < 300) {
          clickCount++;
          if (clickCount > 2) {
            console.log("🚫 Preventing fast click selection");
            event.preventDefault();
            return false;
          }
        } else {
          clickCount = 1;
        }
        lastClickTime = now;
      }

      function handleTextSelectionStrict(event) {
        const textarea = event.target;
        const now = Date.now();
        
        // Prevent multiple rapid triggers
        if (now - lastClickTime < 200) {
          console.log("🚫 Ignoring rapid selection event");
          return;
        }

        // Extra delay for ultra-strict validation
        setTimeout(() => {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          console.log("🖱️ STRICT: Text selection event triggered");
          console.log("📝 STRICT: Selected text:", `"${selectedText}"`);
          console.log("📏 STRICT: Selection length:", selectedText.length);
          console.log("🎯 STRICT: Textarea selection start/end:", textarea.selectionStart, textarea.selectionEnd);

          // ULTRA-STRICT validation criteria
          const isValidSelection = (
            selectedText && 
            selectedText.length >= 3 &&  // Minimum 3 characters (stricter)
            selectedText.length <= 50 && // Maximum 50 characters (stricter)
            textarea.selectionStart !== textarea.selectionEnd && // Must have actual selection range
            !selectedText.includes('\n') && // Don't allow multi-line selections
            selectedText !== textarea.value.trim() && // Don't allow selecting entire content
            selectedText.split(' ').length <= 10 && // Maximum 10 words
            !/^\s+$/.test(selectedText) // Not just whitespace
          );

          console.log("✅ STRICT: Selection validation:", {
            hasText: !!selectedText,
            minLength: selectedText.length >= 3,
            maxLength: selectedText.length <= 50,
            hasRange: textarea.selectionStart !== textarea.selectionEnd,
            singleLine: !selectedText.includes('\n'),
            notEntireContent: selectedText !== textarea.value.trim(),
            maxWords: selectedText.split(' ').length <= 10,
            notWhitespace: !/^\s+$/.test(selectedText),
            isValid: isValidSelection
          });

          if (isValidSelection) {
            // Double-check selection is still valid after delay
            const currentSelection = window.getSelection().toString().trim();
            if (currentSelection === selectedText) {
              // Store selection info
              selectedTextInfo = {
                text: selectedText,
                start: textarea.selectionStart,
                end: textarea.selectionEnd,
                textarea: textarea,
                textareaId: textarea.id,
              };

              // Visual feedback
              console.log("✅ STRICT: Stored valid selection info:", selectedTextInfo);
              textarea.classList.add("has-selection");

              // Show field selector popup with additional delay
              setTimeout(() => {
                showFieldSelector(selectedText);
              }, 200);

              updateValidationMessage(
                `Selected: "${selectedText}" - choose a field to map it to`
              );
            } else {
              console.log("❌ STRICT: Selection changed during validation delay");
            }
          } else {
            console.log("❌ STRICT: Selection did not meet validation criteria");
            selectedTextInfo = null;
            // Remove selection class from all textareas
            document.querySelectorAll(".smart-mapping-textarea").forEach((ta) => {
              ta.classList.remove("has-selection");
            });
            hideFieldSelector();
            updateValidationMessage(
              "Ready to create field mappings - select text in your prompts (3+ characters)"
            );
          }
        }, 250); // Longer delay for ultra-strict mode
      }

      function setupTextSelectionHandlers() {
        const textareas = document.querySelectorAll(".smart-mapping-textarea");

        textareas.forEach((textarea) => {
          // Remove existing listeners to avoid duplicates
          textarea.removeEventListener("mouseup", handleTextSelection);
          textarea.removeEventListener("keyup", handleTextSelection);
          textarea.removeEventListener("mouseup", handleTextSelectionStrict);
          textarea.removeEventListener("keyup", handleTextSelectionStrict);
          textarea.removeEventListener("selectstart", preventFastClicks);
          textarea.removeEventListener("input", handlePromptChange);
          textarea.removeEventListener("paste", handlePasteEvent);

          // Use ultra-strict handlers instead of regular ones
          textarea.addEventListener("mouseup", handleTextSelectionStrict);
          textarea.addEventListener("keyup", handleTextSelectionStrict);
          textarea.addEventListener("selectstart", preventFastClicks);

          // Handle text changes (typing, pasting, etc.)
          textarea.addEventListener("input", handlePromptChange);

          // Handle paste events specifically
          textarea.addEventListener("paste", handlePasteEvent);

          // Make textareas selectable
          textarea.classList.add("select-mode");

          console.log(`✅ Setup ULTRA-STRICT handlers for textarea: ${textarea.id}`);
        });
      }

      function handlePasteEvent(event) {
        console.log("Paste event detected");

        // Use setTimeout to ensure the pasted content is in the DOM
        setTimeout(() => {
          console.log("Processing pasted content...");

          // Check if pasted content contains placeholders we can restore mappings for
          restoreMappingsFromText();

          // Trigger field detection after paste
          detectAndDisplayFields();

          // Update all displays
          updateActiveMappingsDisplay();
          updateFieldTagStates();
          updateMappingStats();

          console.log("Paste processing complete");
        }, 100);
      }

      function restoreMappingsFromText() {
        const systemPrompt =
          document.getElementById("smartMappingSystemPrompt")?.value || "";
        const userPrompt =
          document.getElementById("smartMappingUserPrompt")?.value || "";
        const allPromptText = systemPrompt + " " + userPrompt;

        // Find all {{PLACEHOLDER}} patterns in the text
        const placeholderMatches = [
          ...allPromptText.matchAll(/\{\{([^}]+)\}\}/g),
        ];

        console.log(
          "Found placeholders in pasted text:",
          placeholderMatches.length
        );

        placeholderMatches.forEach((match) => {
          const placeholder = match[0]; // Full {{PLACEHOLDER}}
          const placeholderName = match[1]; // Just PLACEHOLDER

          // Check if we already have a mapping for this placeholder
          const existingMapping = activeMappings.find(
            (m) => m.placeholder === placeholder
          );

          if (!existingMapping) {
            console.log(`Trying to restore mapping for: ${placeholder}`);

            // Try to find a matching field for this placeholder
            const availableFields = getAvailableFields(layout);
            const allFields = [
              ...availableFields.dimensions,
              ...availableFields.measures,
            ];

            // Look for field that matches the placeholder name
            const matchingField = allFields.find((field) => {
              const fieldNameNormalized = field.name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "_");
              const displayNameNormalized = (field.displayName || field.name)
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "_");
              return (
                fieldNameNormalized === placeholderName ||
                displayNameNormalized === placeholderName
              );
            });

            if (matchingField) {
              console.log(
                `Auto-restoring mapping: ${placeholder} → ${matchingField.name}`
              );

              // Create a new mapping
              const mapping = {
                id: `mapping_${Date.now()}_${Math.floor(
                  Math.random() * 10000
                )}`,
                placeholder: placeholder,
                fieldName: matchingField.name,
                fieldType: matchingField.type,
                originalText: placeholderName, // Use placeholder name as original text
                source: systemPrompt.includes(placeholder) ? "system" : "user",
                textareaId: systemPrompt.includes(placeholder)
                  ? "smartMappingSystemPrompt"
                  : "smartMappingUserPrompt",
              };

              activeMappings.push(mapping);
              console.log("Restored mapping:", mapping);
            } else {
              console.log(
                `No matching field found for placeholder: ${placeholder}`
              );
            }
          }
        });
      }

      function handleTextSelection(event) {
        const textarea = event.target;
        
        // Ultra-strict validation to prevent accidental triggers
        setTimeout(() => {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          console.log("🖱️ Text selection event triggered");
          console.log("📝 Selected text:", `"${selectedText}"`);
          console.log("📏 Selection length:", selectedText.length);
          console.log("🎯 Textarea selection start/end:", textarea.selectionStart, textarea.selectionEnd);

          // ULTRA-STRICT validation criteria
          const isValidSelection = (
            selectedText && 
            selectedText.length >= 2 &&  // Minimum 2 characters
            selectedText.length <= 100 && // Maximum 100 characters to prevent whole paragraph selection
            textarea.selectionStart !== textarea.selectionEnd && // Must have actual selection range
            !selectedText.includes('\n') && // Don't allow multi-line selections
            selectedText !== textarea.value.trim() // Don't allow selecting entire content
          );

          console.log("✅ Selection validation:", {
            hasText: !!selectedText,
            minLength: selectedText.length >= 2,
            maxLength: selectedText.length <= 100,
            hasRange: textarea.selectionStart !== textarea.selectionEnd,
            singleLine: !selectedText.includes('\n'),
            notEntireContent: selectedText !== textarea.value.trim(),
            isValid: isValidSelection
          });

          if (isValidSelection) {
            // Store selection info
            selectedTextInfo = {
              text: selectedText,
              start: textarea.selectionStart,
              end: textarea.selectionEnd,
              textarea: textarea,
              textareaId: textarea.id,
            };

            // Visual feedback
            console.log("✅ Stored valid selection info:", selectedTextInfo);
            textarea.classList.add("has-selection");

            // Show field selector popup with delay to ensure selection is stable
            setTimeout(() => {
              showFieldSelector(selectedText);
            }, 100);

            updateValidationMessage(
              `Selected: "${selectedText}" - choose a field to map it to`
            );
          } else {
            console.log("❌ Selection did not meet validation criteria");
            selectedTextInfo = null;
            // Remove selection class from all textareas
            document.querySelectorAll(".smart-mapping-textarea").forEach((ta) => {
              ta.classList.remove("has-selection");
            });
            hideFieldSelector();
            updateValidationMessage(
              "Ready to create field mappings - select text in your prompts"
            );
          }
        }, 150); // Increased delay to ensure selection is complete
      }

      function setupDragDropHandlers() {
        // Use longer timeout to ensure DOM is fully ready
        setTimeout(() => {
          const fieldTags = document.querySelectorAll(
            ".smart-mapping-field-tag"
          );
          console.log(
            "🎯 Setting up drag handlers for",
            fieldTags.length,
            "field tags"
          );

          fieldTags.forEach((tag) => {
            tag.draggable = true;
            tag.style.cursor = "grab";

            // Remove existing listeners to avoid duplicates
            tag.removeEventListener("dragstart", handleFieldDragStart);
            tag.removeEventListener("dragend", handleFieldDragEnd);

            // Add new listeners
            tag.addEventListener("dragstart", handleFieldDragStart);
            tag.addEventListener("dragend", handleFieldDragEnd);

            // Add click handler as fallback
            tag.addEventListener("click", function (e) {
              console.log("🖱️ Field tag clicked:", this.dataset.field);
              if (selectedTextInfo) {
                console.log("✅ Creating mapping via click");
                createFieldMapping(
                  this.dataset.field,
                  this.dataset.type,
                  selectedTextInfo
                );
              } else {
                console.log("⚠️ No text selected - please select text first");
                updateValidationMessage(
                  "Please select text in the prompt first, then click a field"
                );
                setTimeout(() => {
                  updateValidationMessage(
                    "Ready to create field mappings - select text and drag fields"
                  );
                }, 2000);
              }
            });

            // Add visual feedback for draggable items
            tag.addEventListener("mousedown", function () {
              this.style.cursor = "grabbing";
            });

            tag.addEventListener("mouseup", function () {
              this.style.cursor = "grab";
            });
          });
          
          console.log("✅ Drag handlers setup complete");
        }, 500); // Increased delay for better reliability
      }

      function handleFieldDragStart(event) {
        console.log("Drag start triggered");
        const fieldTag = event.target;
        const fieldName = fieldTag.dataset.field;
        const fieldType = fieldTag.dataset.type;

        console.log("Dragging field:", fieldName, "type:", fieldType);
        console.log("Selected text info:", selectedTextInfo);

        // Store drag data
        event.dataTransfer.setData("text/plain", fieldName);
        event.dataTransfer.setData("application/x-field-name", fieldName);
        event.dataTransfer.setData("application/x-field-type", fieldType);

        // Visual feedback
        fieldTag.classList.add("dragging");

        // Show drop zones if in select mode and text is selected
        if (currentMappingMode === "select" && selectedTextInfo) {
          console.log("Showing drop zones for selected text");
          showDropZones();
        } else {
          console.log(
            "Not showing drop zones - mode:",
            currentMappingMode,
            "selected:",
            !!selectedTextInfo
          );
        }
      }

      function handleFieldDragEnd(event) {
        const fieldTag = event.target;
        fieldTag.classList.remove("dragging");
        hideDropZones();
      }

      function handleTextareaDragOver(event) {
        if (currentMappingMode !== "select" || !selectedTextInfo) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";

        const textarea = event.target;
        textarea.classList.add("drag-over");
      }

      function handleTextareaDragLeave(event) {
        const textarea = event.target;
        textarea.classList.remove("drag-over");
      }

      function handleTextareaDrop(event) {
        event.preventDefault();

        const textarea = event.target;
        textarea.classList.remove("drag-over");

        if (currentMappingMode !== "select" || !selectedTextInfo) return;

        const fieldName = event.dataTransfer.getData(
          "application/x-field-name"
        );
        const fieldType = event.dataTransfer.getData(
          "application/x-field-type"
        );

        if (
          fieldName &&
          selectedTextInfo &&
          selectedTextInfo.textarea === textarea
        ) {
          createFieldMapping(fieldName, fieldType, selectedTextInfo);
        }
      }

      function createFieldMapping(fieldName, fieldType, textInfo) {
        // Generate placeholder name from the actual field name
        const placeholderName = fieldName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_");
        const placeholder = `{{${placeholderName}}}`;

        console.log(
          `Creating field mapping: "${textInfo.text}" → ${placeholder} (actual field: ${fieldName})`
        );

        // Replace selected text with placeholder
        const textarea = textInfo.textarea;
        const currentValue = textarea.value;
        const newValue =
          currentValue.substring(0, textInfo.start) +
          placeholder +
          currentValue.substring(textInfo.end);

        textarea.value = newValue;

        // FIXED: Better ID generation to ensure uniqueness
        const mapping = {
          id: `mapping_${Date.now()}_${activeMappings.length}_${Math.floor(Math.random() * 10000)}`,
          placeholder: placeholder,
          fieldName: fieldName, // This is the actual field name for LLM
          fieldType: fieldType,
          originalText: textInfo.text,
          source:
            textInfo.textareaId === "smartMappingSystemPrompt"
              ? "system"
              : "user",
          textareaId: textInfo.textareaId,
        };

        console.log("✅ Created mapping object:", mapping);

        // Add to active mappings
        activeMappings.push(mapping);

        // Update displays
        updateActiveMappingsDisplay();
        updateFieldTagStates();
        updateMappingStats();

        // Clear selection
        selectedTextInfo = null;

        // Success feedback
        updateValidationMessage(
          `✅ Created mapping: "${textInfo.text}" → {{${placeholderName}}} (field: ${fieldName})`
        );

        setTimeout(() => {
          updateValidationMessage(
            "Ready to create field mappings - select text in your prompts"
          );
        }, 3000);
      }

      // ADDITIONAL FIX: Refresh function to rebuild the display if things get out of sync
      function refreshActiveMappingsDisplay() {
        console.log("🔄 Refreshing active mappings display...");
        
        // Regenerate IDs for all mappings to ensure uniqueness
        activeMappings.forEach((mapping, index) => {
          if (!mapping.id || !mapping.id.includes('mapping_')) {
            mapping.id = `mapping_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`;
            console.log(`🔧 Regenerated ID for mapping ${index}:`, mapping.id);
          }
        });

        // Update all displays
        updateActiveMappingsDisplay();
        updateFieldTagStates();
        updateMappingStats();
        
        console.log("✅ Refresh complete");
      }

      // Quick fix function for console debugging
      window.fixMappingIds = function() {
        console.log("🔧 Fixing mapping IDs...");
        activeMappings.forEach((mapping, index) => {
          const oldId = mapping.id;
          mapping.id = `mapping_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`;
          console.log(`Fixed mapping ${index}: ${oldId} → ${mapping.id}`);
        });
        updateActiveMappingsDisplay();
        console.log("✅ Fixed mapping IDs:", activeMappings.map(m => m.id));
        return activeMappings.length;
      };

      function updateActiveMappingsDisplay() {
        const container = document.getElementById("smartMappingActiveList");
        if (!container) return;

        console.log("🔄 Updating active mappings display with:", activeMappings.length, "mappings");

        if (activeMappings.length === 0) {
          container.innerHTML = `
            <div class="empty-mappings-state">
              <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🎯</div>
                <div style="font-size: 14px; margin-bottom: 8px; font-weight: 600;">No Field Mappings Yet</div>
                <div style="font-size: 12px; opacity: 0.7; line-height: 1.4;">
                  Select text in your prompts, then drag fields from the left panel to create mappings
                </div>
              </div>
            </div>
          `;
          return;
        }

        const mappingsHTML = activeMappings
          .map((mapping, index) => {
            // Ensure each mapping has a valid ID
            if (!mapping.id) {
              mapping.id = `mapping_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`;
              console.log("🔧 Generated new ID for mapping:", mapping.id);
            }

            console.log(`🔍 Rendering mapping ${index}:`, mapping.id, "→", mapping.placeholder);

            return `
            <div class="smart-mapping-active-mapping" style="
              background: white;
              border: 1px solid #e8f5e8;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 8px;
              border-left: 4px solid #4caf50;
            ">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 12px; color: #2e7d32; margin-bottom: 4px;">
                    ${mapping.placeholder}
                    <span style="
                      background: ${
                        mapping.source === "system" ? "#e3f2fd" : "#fff3e0"
                      };
                      color: ${
                        mapping.source === "system" ? "#1565c0" : "#ef6c00"
                      };
                      padding: 2px 6px;
                      border-radius: 10px;
                      font-size: 9px;
                      margin-left: 6px;
                    ">${mapping.source}</span>
                  </div>
                  <div style="font-size: 10px; color: #6c757d; margin-bottom: 4px;">
                    Original: "${mapping.originalText}"
                  </div>
                  <div style="font-size: 10px; color: #6c757d;">
                    Field: ${mapping.fieldName} (${mapping.fieldType})
                  </div>
                </div>
                <button 
                  onclick="removeFieldMapping('${mapping.id}')"
                  data-mapping-id="${mapping.id}"
                  style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                    flex-shrink: 0;
                  "
                  title="Remove mapping"
                >Remove</button>
              </div>
            </div>
          `;
          })
          .join("");

        container.innerHTML = mappingsHTML;
        console.log("✅ Active mappings display updated");
      }

      function updateFieldTagStates() {
        const usedFields = new Set(activeMappings.map((m) => m.fieldName));

        console.log("🏷️ Updating field tag states:");
        console.log("📋 Active mappings:", activeMappings);
        console.log("🎯 Used fields:", Array.from(usedFields));

        const fieldTags = document.querySelectorAll(".smart-mapping-field-tag");
        console.log("🏷️ Found field tags:", fieldTags.length);

        let markedCount = 0;
        fieldTags.forEach((tag) => {
          const fieldName = tag.dataset.field;
          const isUsed = usedFields.has(fieldName);
          
          console.log(`🏷️ Field '${fieldName}': ${isUsed ? '✅ USED' : '⚪ unused'}`);
          
          // Update the tag's appearance
          tag.classList.toggle("used", isUsed);
          
          // FORCE inline styles as backup in case CSS isn't working
          if (isUsed) {
            tag.style.background = '#e8f5e8';
            tag.style.borderColor = '#4caf50';
            tag.style.color = '#2e7d32';
            tag.style.position = 'relative';
            tag.style.boxShadow = '0 0 0 1px #4caf50';
            
            // Add checkmark via direct style manipulation
            tag.setAttribute('data-used', 'true');
            console.log(`✅ Applied inline styles to field '${fieldName}'`);
            
            markedCount++;
            console.log(`✅ Marked field '${fieldName}' as used`);
          } else {
            // Remove inline styles for unused fields
            tag.style.background = '';
            tag.style.borderColor = '';
            tag.style.color = '';
            tag.style.position = '';
            tag.style.boxShadow = '';
            tag.removeAttribute('data-used');
          }
        });

        console.log(`🎯 Marked ${markedCount} fields as used out of ${fieldTags.length} total`);
      }

      function updateMappingStats() {
        const statsContainer = document.getElementById("smartMappingStats");
        if (!statsContainer) {
          console.log("⚠️ Stats container not found!");
          return;
        }

        console.log(
          "📊 Updating mapping stats with active mappings:",
          activeMappings.length,
          activeMappings
        );

        const activeMappingsCount = activeMappings.length;
        const usedFieldsCount = new Set(activeMappings.map((m) => m.fieldName))
          .size;

        // Calculate replacements count
        const systemPrompt =
          document.getElementById("smartMappingSystemPrompt")?.value || "";
        const userPrompt =
          document.getElementById("smartMappingUserPrompt")?.value || "";
        const allPromptText = systemPrompt + " " + userPrompt;

        const replacementsCount = activeMappings.reduce((total, mapping) => {
          const occurrences = allPromptText.split(mapping.placeholder).length - 1;
          console.log(
            `Placeholder ${mapping.placeholder} appears ${occurrences} times in prompts`
          );
          return total + occurrences;
        }, 0);

        // Count total placeholders in prompts (both mapped and unmapped)
        const placeholderMatches = allPromptText.match(/\{\{[^}]+\}\}/g) || [];
        const totalFieldsDetected = placeholderMatches.length;
        const mappedCount = activeMappingsCount; // These are the ones we have mappings for
        const needMappingCount = Math.max(0, totalFieldsDetected - mappedCount);

        console.log(
          `📊 Stats calculation: ${totalFieldsDetected} detected, ${mappedCount} mapped, ${needMappingCount} need mapping`
        );

        // Update the display - use "Mapped" to match what user expects to see
        statsContainer.innerHTML = `
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${totalFieldsDetected}</div>
            <div class="smart-mapping-stat-label">Fields Detected</div>
          </div>
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${mappedCount}</div>
            <div class="smart-mapping-stat-label">Mapped</div>
          </div>
          <div class="smart-mapping-stat">
            <div class="smart-mapping-stat-number">${needMappingCount}</div>
            <div class="smart-mapping-stat-label">Need Mapping</div>
          </div>
        `;

        console.log(`✅ Stats updated: detected=${totalFieldsDetected}, mapped=${mappedCount}, need=${needMappingCount}`);
      }

      function handleClearAllMappings() {
        if (activeMappings.length === 0) return;

        const confirm = window.confirm(
          `Are you sure you want to clear all ${activeMappings.length} mappings?`
        );
        if (!confirm) return;

        // Remove all placeholders from textareas
        activeMappings.forEach((mapping) => {
          const textarea = document.getElementById(mapping.textareaId);
          if (textarea) {
            textarea.value = textarea.value.replace(
              new RegExp(mapping.placeholder.replace(/[{}]/g, "\\$&"), "g"),
              mapping.originalText
            );
          }
        });

        // Clear mappings
        activeMappings = [];

        // Update displays
        updateActiveMappingsDisplay();
        updateFieldTagStates();
        updateMappingStats();

        updateValidationMessage("✅ All mappings cleared");
        setTimeout(() => {
          updateValidationMessage(
            "Ready to create field mappings - select text in your prompts"
          );
        }, 2000);
      }

      function showDropZones() {
        // Visual feedback for drop zones could be added here
        console.log("Showing drop zones");
      }

      function hideDropZones() {
        // Hide drop zones
        console.log("Hiding drop zones");
      }

      function updateValidationMessage(message) {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.textContent = message;
        }
      }

      // Function to update existing mappings when field names change
      function updateMappingsWithNewFieldNames(availableFields) {
        if (activeMappings.length === 0) {
          console.log("No active mappings to update");
          return;
        }

        // Create a map of all current field names
        const allCurrentFields = [
          ...availableFields.dimensions.map((d) => d.name),
          ...availableFields.measures.map((m) => m.name),
        ];

        console.log("🔄 Updating mappings with new field names:");
        console.log("Available fields:", allCurrentFields);
        console.log("Current mappings before update:", activeMappings);

        let updatedCount = 0;
        let removedCount = 0;

        // Check each mapping to see if the field still exists or has been renamed
        activeMappings.forEach((mapping, index) => {
          const oldFieldName = mapping.fieldName;

          // If the field still exists, no need to update
          if (allCurrentFields.includes(oldFieldName)) {
            console.log(
              `✅ Field '${oldFieldName}' still exists - no update needed`
            );
            return;
          }

          console.log(
            `🔍 Field '${oldFieldName}' no longer exists, looking for replacement...`
          );

          // Try to find a field with similar name (case-insensitive, partial match)
          const similarField = allCurrentFields.find((field) => {
            const oldLower = oldFieldName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
            const newLower = field.toLowerCase().replace(/[^a-z0-9]/g, "");

            // Exact match after cleaning (handles spaces, symbols, etc.)
            if (oldLower === newLower) {
              console.log(
                `  📍 Exact match found: '${oldFieldName}' → '${field}'`
              );
              return true;
            }

            // Check if one contains the other (handles additions like $ symbol)
            if (oldLower.includes(newLower) || newLower.includes(oldLower)) {
              console.log(
                `  📍 Contains match found: '${oldFieldName}' → '${field}'`
              );
              return true;
            }

            // Check for common patterns in measure names
            const oldBase = oldLower.replace(
              /sum|avg|count|max|min|total|amount|\$|dollar/g,
              ""
            );
            const newBase = newLower.replace(
              /sum|avg|count|max|min|total|amount|\$|dollar/g,
              ""
            );
            if (oldBase === newBase && oldBase.length > 3) {
              console.log(
                `  📍 Pattern match found: '${oldFieldName}' → '${field}'`
              );
              return true;
            }

            // Check for common keywords (at least 80% word similarity)
            const oldWords = oldFieldName
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length > 2);
            const newWords = field
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length > 2);
            const commonWords = oldWords.filter((word) =>
              newWords.some(
                (newWord) => newWord.includes(word) || word.includes(newWord)
              )
            );

            const similarity =
              commonWords.length / Math.max(oldWords.length, newWords.length);
            if (similarity >= 0.8) {
              console.log(
                `  📍 Keyword match found (${Math.round(
                  similarity * 100
                )}%): '${oldFieldName}' → '${field}'`
              );
              return true;
            }

            return false;
          });

          if (similarField) {
            console.log(
              `✅ Found replacement: '${oldFieldName}' → '${similarField}'`
            );
            mapping.fieldName = similarField;

            // Update the field type if needed
            const isDimension = availableFields.dimensions.some(
              (d) => d.name === similarField
            );
            mapping.fieldType = isDimension ? "dimension" : "measure";
            updatedCount++;
          } else {
            console.log(
              `❌ No replacement found for '${oldFieldName}' - marking as invalid`
            );
            mapping.invalid = true;
            removedCount++;
          }
        });

        // Remove invalid mappings
        if (removedCount > 0) {
          const validMappings = activeMappings.filter(
            (mapping) => !mapping.invalid
          );

          // Remove invalid placeholders from textareas
          activeMappings.forEach((mapping) => {
            if (mapping.invalid) {
              const textarea = document.getElementById(mapping.textareaId);
              if (textarea) {
                const oldValue = textarea.value;
                const newValue = textarea.value.replace(
                  new RegExp(mapping.placeholder.replace(/[{}]/g, "\\$&"), "g"),
                  mapping.originalText
                );
                textarea.value = newValue;
                console.log(
                  `Removed invalid placeholder ${mapping.placeholder} from textarea`
                );
              }
            }
          });

          activeMappings = validMappings;
          console.log(`🗑️ Removed ${removedCount} invalid mappings`);
        }

        console.log(
          `🔄 Mapping update complete: ${updatedCount} updated, ${removedCount} removed`
        );
        console.log("Final mappings after update:", activeMappings);
      }

      // Field Selector Functions
      function showFieldSelector(selectedText) {
        const popup = document.getElementById("fieldSelectorPopup");
        const selectedTextDisplay = document.getElementById(
          "selectedTextDisplay"
        );

        if (!popup || !selectedTextDisplay) return;

        // Update selected text display
        selectedTextDisplay.textContent = selectedText;

        // Populate field options
        populateFieldSelectorOptions();

        // Show popup
        popup.style.display = "block";
      }

      function hideFieldSelector() {
        const popup = document.getElementById("fieldSelectorPopup");
        if (popup) {
          popup.style.display = "none";
        }
      }

      function populateFieldSelectorOptions() {
        const availableFields = getAvailableFields(layout);
        const usedFields = new Set(activeMappings.map((m) => m.fieldName));

        // Populate dimensions
        const dimensionsContainer = document.getElementById(
          "fieldSelectorDimensions"
        );
        if (dimensionsContainer) {
          if (availableFields.dimensions.length === 0) {
            dimensionsContainer.innerHTML =
              '<div style="color: #999; font-size: 12px; padding: 8px;">No dimensions available</div>';
          } else {
            dimensionsContainer.innerHTML = availableFields.dimensions
              .map(
                (dim) => `
              <div class="field-selector-option ${
                usedFields.has(dim.name) ? "used" : ""
              }" 
                   onclick="selectField('${dim.name}', 'dimension')"
                   title="Field: ${dim.name}${
                  dim.displayName !== dim.name
                    ? "\nLabel: " + dim.displayName
                    : ""
                }">
                <div style="font-weight: 500;">${
                  dim.displayName || dim.name
                }</div>
                ${
                  dim.displayName !== dim.name
                    ? `<div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${dim.name}</div>`
                    : ""
                }
              </div>
            `
              )
              .join("");
          }
        }

        // Populate measures
        const measuresContainer = document.getElementById(
          "fieldSelectorMeasures"
        );
        if (measuresContainer) {
          if (availableFields.measures.length === 0) {
            measuresContainer.innerHTML =
              '<div style="color: #999; font-size: 12px; padding: 8px;">No measures available</div>';
          } else {
            measuresContainer.innerHTML = availableFields.measures
              .map(
                (measure) => `
              <div class="field-selector-option ${
                usedFields.has(measure.name) ? "used" : ""
              }" 
                   onclick="selectField('${measure.name}', 'measure')"
                   title="Field: ${measure.name}${
                  measure.displayName !== measure.name
                    ? "\nLabel: " + measure.displayName
                    : ""
                }">
                <div style="font-weight: 500;">${
                  measure.displayName || measure.name
                }</div>
                ${
                  measure.displayName !== measure.name
                    ? `<div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${measure.name}</div>`
                    : ""
                }
              </div>
            `
              )
              .join("");
          }
        }
      }

      // Global functions for field selector
      window.selectField = function (fieldName, fieldType) {
        if (selectedTextInfo) {
          createFieldMapping(fieldName, fieldType, selectedTextInfo);
          hideFieldSelector();
        }
      };

      window.hideFieldSelector = hideFieldSelector;

      // FIXED: Enhanced removeFieldMapping function with better error handling
      window.removeFieldMapping = function (mappingId) {
        console.log("🗑️ Attempting to remove mapping with ID:", mappingId);
        console.log("🗑️ Current active mappings:", activeMappings);
        console.log("🗑️ Available mapping IDs:", activeMappings.map(m => m.id));

        // Find the mapping by ID
        const mappingIndex = activeMappings.findIndex((m) => m.id === mappingId);
        const mapping = activeMappings[mappingIndex];
        
        if (!mapping) {
          console.error("❌ Mapping not found with ID:", mappingId);
          console.log("🔍 Attempting to find by placeholder or fieldName...");
          
          // Fallback: Try to find by other properties if ID doesn't match
          const fallbackMapping = activeMappings.find(m => 
            m.placeholder && m.placeholder.includes(mappingId.split('_').pop()) // Try last part of ID
          );
          
          if (fallbackMapping) {
            console.log("✅ Found mapping by fallback method:", fallbackMapping);
            const fallbackIndex = activeMappings.indexOf(fallbackMapping);
            return removeByIndex(fallbackIndex, fallbackMapping);
          }
          
          // If still not found, show user-friendly message and refresh
          alert("⚠️ Could not remove mapping. The mapping list will be refreshed.");
          refreshActiveMappingsDisplay();
          return;
        }

        console.log("✅ Found mapping to remove:", mapping);
        return removeByIndex(mappingIndex, mapping);
      };

      // Helper function to actually remove the mapping
      function removeByIndex(index, mapping) {
        console.log(`🗑️ Removing mapping at index ${index}:`, mapping);

        // Remove placeholder from textarea
        const textarea = document.getElementById(mapping.textareaId);
        if (textarea) {
          const oldValue = textarea.value;
          const newValue = textarea.value.replace(
            new RegExp(mapping.placeholder.replace(/[{}]/g, "\\$&"), "g"),
            mapping.originalText
          );
          textarea.value = newValue;
          console.log("📝 Updated textarea:", oldValue, "→", newValue);
        } else {
          console.warn("⚠️ Textarea not found:", mapping.textareaId);
        }

        // Remove from active mappings
        activeMappings.splice(index, 1);
        console.log("✅ Active mappings after removal:", activeMappings);

        // Update all displays
        updateActiveMappingsDisplay();
        updateFieldTagStates();
        updateMappingStats();

        // Show success message
        updateValidationMessage(`✅ Removed mapping: ${mapping.placeholder}`);
        setTimeout(() => {
          updateValidationMessage(
            "Ready to create field mappings - select text in your prompts"
          );
        }, 2000);

        return true;
      }

      // ===== END STEP 4 FUNCTIONS =====
      // NEW: Smart Field Mapping Modal Functions
      function createSmartFieldMappingModal() {
        // Check if modal already exists
        if (document.getElementById("smartFieldMappingModal")) {
          return;
        }

        // Create modal HTML
        const modalHTML = `
          <!-- Modal Overlay -->
          <div id="smartFieldMappingModal" class="smart-mapping-modal-overlay">
            <div class="smart-mapping-modal-container">
              <!-- Modal Header -->
              <div class="smart-mapping-modal-header">
                <div class="smart-mapping-modal-title">
                  Smart Field Mapping
                </div>
                <button class="smart-mapping-close-btn" onclick="closeSmartFieldMappingModal()">×</button>
              </div>
              
              <!-- Modal Content -->
              <div class="smart-mapping-modal-content">
                <!-- Left Panel: Available Fields -->
                <div class="smart-mapping-available-panel">
                  <div class="smart-mapping-section full-height">
                    <div class="smart-mapping-section-header">
                      Available Data Fields
                      <button id="smartMappingRefreshBtn" class="smart-mapping-auto-map-btn" style="background: #17a2b8;">
                        Refresh
                      </button>
                    </div>
                    <div class="smart-mapping-available-fields full-height">
                      <div class="smart-mapping-field-group">
                        <div class="smart-mapping-field-group-header">
                          📊 Dimensions
                        </div>
                        <div id="smartMappingDimensions" class="smart-mapping-field-tags">
                          <!-- Dimensions will be populated here -->
                        </div>
                      </div>
                      <div class="smart-mapping-field-group">
                        <div class="smart-mapping-field-group-header">
                          📈 Measures
                        </div>
                        <div id="smartMappingMeasures" class="smart-mapping-field-tags">
                          <!-- Measures will be populated here -->
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Middle Panel: Prompts -->
                <div class="smart-mapping-prompts-panel">
                  <div class="smart-mapping-prompt-section">
                    <div class="smart-mapping-prompt-header">
                      System Prompt
                      <div class="prompt-mode-indicator">
                        <span>Select text to map to fields</span>
                      </div>
                    </div>
                    <div class="smart-mapping-prompt-container" style="position: relative;">
                      <textarea id="smartMappingSystemPrompt" class="smart-mapping-textarea" 
                                placeholder="Enter your system prompt. Select any text to map it to a field..."></textarea>
                      <div id="systemPromptOverlay" class="prompt-overlay"></div>
                    </div>
                  </div>
                  
                  <div class="smart-mapping-prompt-section">
                    <div class="smart-mapping-prompt-header">
                      User Prompt
                      <div class="prompt-mode-indicator">
                        <span>Select text to map to fields</span>
                      </div>
                    </div>
                    <div class="smart-mapping-prompt-container" style="position: relative;">
                      <textarea id="smartMappingUserPrompt" class="smart-mapping-textarea" 
                                placeholder="Enter your user prompt. Select any text to map it to a field..."></textarea>
                      <div id="userPromptOverlay" class="prompt-overlay"></div>
                    </div>
                  </div>
                </div>
                
                <!-- Right Panel: Active Mappings -->
                <div class="smart-mapping-results-panel">
                  <!-- Active Mappings -->
                  <div class="smart-mapping-section large-section">
                    <div class="smart-mapping-section-header">
                      <div class="smart-mapping-header-content">
                        <span class="smart-mapping-header-title">Active Mappings</span>
                        <div class="smart-mapping-toolbar">
                          <button id="smartMappingClearAllBtn" class="smart-mapping-toolbar-btn secondary">
                            <span class="btn-icon">❌</span>
                            Clear All
                          </button>
                        </div>
                      </div>
                    </div>
                    <div id="smartMappingActiveList" class="smart-mapping-fields-list large-list">
                      <div class="empty-mappings-state">
                        <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🎯</div>
                          <div style="font-size: 14px; margin-bottom: 8px; font-weight: 600;">No Field Mappings Yet</div>
                          <div style="font-size: 12px; opacity: 0.7; line-height: 1.4;">
                            Select text in your prompts, then drag fields from the left panel to create mappings
                          </div>
                        </div>
                      </div>
                    </div>
                    <div id="smartMappingStats" class="smart-mapping-stats">
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Active Mappings</div>
                      </div>
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Fields Used</div>
                      </div>
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Replacements</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Field Selector Popup -->
              <div id="fieldSelectorPopup" class="field-selector-popup" style="display: none;">
                <div class="field-selector-header">
                  <span class="field-selector-title">Map to Field</span>
                  <button class="field-selector-close" onclick="hideFieldSelector()">×</button>
                </div>
                <div class="field-selector-content">
                  <div class="selected-text-display">
                    <span class="selected-text-label">Selected text:</span>
                    <span id="selectedTextDisplay" class="selected-text-value"></span>
                  </div>
                  <div class="field-selector-sections">
                    <div class="field-selector-section">
                      <div class="field-selector-section-title">📊 Dimensions</div>
                      <div id="fieldSelectorDimensions" class="field-selector-options">
                        <!-- Dimensions will be populated here -->
                      </div>
                    </div>
                    <div class="field-selector-section">
                      <div class="field-selector-section-title">📈 Measures</div>
                      <div id="fieldSelectorMeasures" class="field-selector-options">
                        <!-- Measures will be populated here -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Modal Footer -->
              <div class="smart-mapping-modal-footer">
                <div id="smartMappingValidation" class="smart-mapping-validation">
                  Ready to create field mappings - select text in your prompts
                </div>
                <div class="smart-mapping-actions">
                  <button class="smart-mapping-btn smart-mapping-btn-secondary" onclick="closeSmartFieldMappingModal()">
                    Cancel
                  </button>
                  <button id="smartMappingSaveBtn" class="smart-mapping-btn smart-mapping-btn-primary">
                    Save Mappings
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML("beforeend", modalHTML);

        // Add modal styles
        addSmartFieldMappingStyles();

        // Set up modal event listeners
        setupSmartFieldMappingEvents();

        // Make modal globally accessible
        window.openSmartFieldMappingModal = openSmartFieldMappingModal;
        window.closeSmartFieldMappingModal = closeSmartFieldMappingModal;
      }

      function addSmartFieldMappingStyles() {
        if (document.getElementById("smartFieldMappingStyles")) {
          return;
        }

        const styles = `
    <style id="smartFieldMappingStyles">
      .smart-mapping-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }
      
      .smart-mapping-modal-overlay.active {
        display: flex;
      }
      
      .smart-mapping-modal-container {
        width: 95vw;
        max-width: 1400px;
        height: 90vh;
        max-height: 800px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .smart-mapping-modal-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      
      .smart-mapping-modal-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .smart-mapping-mode-toggle {
        display: flex;
        background: rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 4px;
        gap: 2px;
      }
      
      .mode-btn {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.7);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      
      .mode-btn.active {
        background: rgba(255,255,255,0.2);
        color: white;
        font-weight: 600;
      }
      
      .mode-btn:hover:not(.active) {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.9);
      }
      
      .smart-mapping-close-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .smart-mapping-close-btn:hover {
        background: rgba(255,255,255,0.25);
        transform: scale(1.05);
      }
      
      .smart-mapping-modal-content {
        flex: 1;
        display: grid;
        grid-template-columns: 280px 1fr 360px;
        overflow: hidden;
        min-height: 0;
      }
      
      .smart-mapping-available-panel {
        background: white;
        border-right: 1px solid #e9ecef;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      
      .smart-mapping-prompts-panel {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        border-right: 1px solid #e9ecef;
        overflow-y: auto;
        background: #fafbfc;
      }
      
      .smart-mapping-results-panel {
        background: white;
        padding: 24px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-height: 0;
      }
      
      .smart-mapping-prompt-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      
      .smart-mapping-prompt-header {
        font-size: 14px;
        font-weight: 600;
        color: #495057;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      
      .prompt-mode-indicator {
        font-size: 11px;
        color: #6c757d;
        font-weight: 400;
        opacity: 0.8;
      }
      
      .smart-mapping-prompt-container {
        flex: 1;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        overflow: hidden;
        background: white;
        min-height: 0;
      }
      
      .smart-mapping-prompt-container:focus-within {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .smart-mapping-textarea {
        width: 100%;
        height: 100%;
        min-height: 180px;
        padding: 16px;
        border: none;
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
        resize: none;
        background: white;
        box-sizing: border-box;
        color: #495057;
      }
      
      .smart-mapping-textarea:focus {
        outline: none;
      }
      
      .smart-mapping-textarea::placeholder {
        color: #adb5bd;
      }
      
      /* Text Selection Styles */
      .smart-mapping-textarea.select-mode {
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }
      
      .smart-mapping-textarea.select-mode::selection {
        background: #e3f2fd;
        color: #1565c0;
      }
      
      .smart-mapping-textarea.select-mode::-moz-selection {
        background: #e3f2fd;
        color: #1565c0;
      }
      
      .smart-mapping-textarea.has-selection {
        border-color: #2196f3 !important;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2) !important;
      }
      
      .text-selected {
        background: #e3f2fd !important;
        border: 2px solid #2196f3 !important;
        border-radius: 4px !important;
        padding: 2px 4px !important;
        color: #1565c0 !important;
        font-weight: 500 !important;
      }
      
      .drag-over {
        background: #e8f5e8 !important;
        border-color: #4caf50 !important;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.3) !important;
      }
      
      .field-placeholder {
        background: #e8f5e8;
        border: 1px solid #4caf50;
        border-radius: 4px;
        padding: 2px 6px;
        color: #2e7d32;
        font-weight: 500;
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        font-size: 12px;
      }
      
      /* Field Tag States - ENHANCED with higher specificity */
      .smart-mapping-field-tag.used,
      .smart-mapping-field-tags .smart-mapping-field-tag.used {
        background: #e8f5e8 !important;
        border-color: #4caf50 !important;
        color: #2e7d32 !important;
        position: relative !important;
        box-shadow: 0 0 0 1px #4caf50 !important;
      }
      
      .smart-mapping-field-tag.used::after,
      .smart-mapping-field-tags .smart-mapping-field-tag.used::after,
      .smart-mapping-field-tag[data-used="true"]::after {
        content: '✓' !important;
        position: absolute !important;
        top: -4px !important;
        right: -4px !important;
        background: #4caf50 !important;
        color: white !important;
        border-radius: 50% !important;
        width: 18px !important;
        height: 18px !important;
        font-size: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-weight: bold !important;
        z-index: 10 !important;
        border: 2px solid white !important;
      }
      
      /* Additional backup styles using data attribute */
      .smart-mapping-field-tag[data-used="true"] {
        background: #e8f5e8 !important;
        border-color: #4caf50 !important;
        color: #2e7d32 !important;
        position: relative !important;
        box-shadow: 0 0 0 1px #4caf50 !important;
      }
      
      .smart-mapping-field-tag.dragging {
        opacity: 0.5;
        transform: scale(0.95);
      }
      
      /* Drop Zone Styles */
      .drop-zone {
        border: 2px dashed #4caf50;
        background: rgba(76, 175, 80, 0.1);
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
        text-align: center;
        color: #2e7d32;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      
      .drop-zone.active {
        background: rgba(76, 175, 80, 0.2);
        border-color: #388e3c;
        transform: scale(1.02);
      }
      
      /* Empty State */
      .empty-mappings-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 200px;
      }
      
      /* Field Selector Popup */
      .field-selector-popup {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #2196f3;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 10001;
        min-width: 320px;
        max-width: 400px;
        max-height: 80vh;
        overflow: hidden;
      }
      
      .field-selector-header {
        background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .field-selector-title {
        font-weight: 600;
        font-size: 14px;
      }
      
      .field-selector-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .field-selector-close:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .field-selector-content {
        padding: 16px;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .selected-text-display {
        background: #f0f8ff;
        border: 1px solid #e3f2fd;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 16px;
        font-size: 12px;
      }
      
      .selected-text-label {
        color: #666;
        font-weight: 500;
      }
      
      .selected-text-value {
        color: #1976d2;
        font-weight: 600;
        margin-left: 8px;
      }
      
      .field-selector-sections {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .field-selector-section-title {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .field-selector-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .field-selector-option {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .field-selector-option:hover {
        background: #e3f2fd;
        border-color: #2196f3;
        color: #1976d2;
        transform: translateY(-1px);
      }
      
      .field-selector-option.used {
        background: #e8f5e8;
        border-color: #4caf50;
        color: #2e7d32;
      }
      
      .field-selector-option.used::after {
        content: '✓';
        color: #4caf50;
        font-weight: bold;
      }
      
      /* Basic Field Highlighting Styles */
      .field-highlight {
        background: #e3f2fd;
        border: 1px solid #2196f3;
        border-radius: 3px;
        padding: 1px 2px;
        display: inline;
        font-weight: 500;
      }
      
      .field-highlight.intelligent {
        background: #e8f5e8;
        border-color: #4caf50;
        color: #2e7d32;
      }
      
      .field-highlight.traditional {
        background: #fff3e0;
        border-color: #ff9800;
        color: #f57c00;
      }
      
      .prompt-preview {
        margin-top: 8px !important;
        padding: 12px !important;
        background: #f0f8ff !important;
        border: 2px solid #4CAF50 !important;
        border-radius: 6px !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        min-height: 60px !important;
        max-height: 200px !important;
        overflow-y: auto !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      
      .prompt-preview:empty {
        display: none !important;
      }
      
      .prompt-preview:not(:empty) {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      #systemPromptPreview, #userPromptPreview {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      .prompt-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
        color: transparent;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        box-sizing: border-box;
        z-index: 1;
      }
      
      .prompt-overlay .field-highlight {
        background: rgba(46, 125, 50, 0.15) !important;
        border-bottom: 2px solid #4CAF50 !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        color: transparent !important;
        display: inline !important;
      }
      
      .prompt-overlay .field-highlight.intelligent {
        background: rgba(46, 125, 50, 0.2) !important;
        border-bottom: 2px solid #4CAF50 !important;
      }
      
      .prompt-overlay .field-highlight.traditional {
        background: rgba(255, 152, 0, 0.2) !important;
        border-bottom: 2px solid #FF9800 !important;
      }


      
      .smart-mapping-section {
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .smart-mapping-section.full-height {
        flex: 1;
        display: flex;
        flex-direction: column;
        border: none;
        border-radius: 0;
      }
      
      .smart-mapping-section.large-section {
        flex: 2;
        min-height: 400px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      

      
      .smart-mapping-section-header {
        background: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #e9ecef;
        font-size: 14px;
        font-weight: 600;
        color: #495057;
        flex-shrink: 0;
      }
      
      .smart-mapping-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      
      .smart-mapping-header-title {
        font-size: 14px;
        font-weight: 600;
        color: #495057;
      }
      
      .smart-mapping-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .smart-mapping-toolbar-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      
      .smart-mapping-toolbar-btn.primary {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
      }
      
      .smart-mapping-toolbar-btn.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
      }
      
      .smart-mapping-toolbar-btn.secondary {
        background: #f8f9fa;
        color: #6c757d;
        border: 1px solid #e9ecef;
      }
      
      .smart-mapping-toolbar-btn.secondary:hover {
        background: #e9ecef;
        color: #495057;
      }
      
      .btn-icon {
        font-size: 12px;
      }
      
      .smart-mapping-auto-map-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .smart-mapping-auto-map-btn:hover {
        background: #218838;
        transform: translateY(-1px);
      }
      
      .smart-mapping-add-field-btn {
        background: #007bff;
        color: white;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: auto;
      }
      
      .smart-mapping-add-field-btn:hover {
        background: #0056b3;
        transform: translateY(-1px);
      }
      
      .smart-mapping-fields-list {
        padding: 16px;
        min-height: 60px;
        max-height: 240px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #ced4da #f8f9fa;
      }
      
      .smart-mapping-fields-list.large-list {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        height: 100%;
        scrollbar-width: thin;
        scrollbar-color: #ced4da #f8f9fa;
        padding: 16px;
      }
      
      .smart-mapping-fields-list.full-height {
        flex: 1;
        max-height: none;
        height: 100%;
        overflow-y: auto;
      }
      
      .smart-mapping-fields-list::-webkit-scrollbar {
        width: 6px;
      }
      
      .smart-mapping-fields-list::-webkit-scrollbar-track {
        background: #f8f9fa;
        border-radius: 3px;
      }
      
      .smart-mapping-fields-list::-webkit-scrollbar-thumb {
        background: #ced4da;
        border-radius: 3px;
      }
      
      .smart-mapping-fields-list::-webkit-scrollbar-thumb:hover {
        background: #adb5bd;
      }
      
      .smart-mapping-fields-list.large-list::-webkit-scrollbar {
        width: 8px;
      }
      
      .smart-mapping-fields-list.large-list::-webkit-scrollbar-track {
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      .smart-mapping-fields-list.large-list::-webkit-scrollbar-thumb {
        background: #ced4da;
        border-radius: 4px;
      }
      
      .smart-mapping-fields-list.large-list::-webkit-scrollbar-thumb:hover {
        background: #adb5bd;
      }
      
      .smart-mapping-stats {
        padding: 12px 16px;
        display: flex;
        justify-content: space-around;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
        flex-shrink: 0;
        margin-top: 8px;
      }
      
      .smart-mapping-stat {
        text-align: center;
      }
      
      .smart-mapping-stat-number {
        font-size: 18px;
        font-weight: 700;
        color: #667eea;
        line-height: 1.2;
      }
      
      .smart-mapping-stat-label {
        font-size: 9px;
        color: #6c757d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }
      
      .smart-mapping-available-fields {
        padding: 16px;
        max-height: 240px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #ced4da #f8f9fa;
      }
      
      .smart-mapping-available-fields.full-height {
        flex: 1;
        max-height: none;
        height: 100%;
      }
      
      .smart-mapping-available-fields::-webkit-scrollbar {
        width: 6px;
      }
      
      .smart-mapping-available-fields::-webkit-scrollbar-track {
        background: #f8f9fa;
        border-radius: 3px;
      }
      
      .smart-mapping-available-fields::-webkit-scrollbar-thumb {
        background: #ced4da;
        border-radius: 3px;
      }
      
      .smart-mapping-available-fields::-webkit-scrollbar-thumb:hover {
        background: #adb5bd;
      }
      
      .smart-mapping-field-group {
        margin-bottom: 16px;
      }
      
      .smart-mapping-field-group:last-child {
        margin-bottom: 0;
      }
      
      .smart-mapping-field-group-header {
        font-size: 11px;
        font-weight: 600;
        color: #6c757d;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .smart-mapping-field-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-height: 200px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: #ced4da #f8f9fa;
        width: 100%;
        box-sizing: border-box;
      }
      
      .smart-mapping-field-tags::-webkit-scrollbar {
        width: 6px;
      }
      
      .smart-mapping-field-tags::-webkit-scrollbar-track {
        background: #f8f9fa;
        border-radius: 3px;
      }
      
      .smart-mapping-field-tags::-webkit-scrollbar-thumb {
        background: #ced4da;
        border-radius: 3px;
      }
      
      .smart-mapping-field-tags::-webkit-scrollbar-thumb:hover {
        background: #adb5bd;
      }
      
      .smart-mapping-field-tag {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      
      .smart-mapping-field-tag.dimension {
        background: #e3f2fd;
        color: #1565c0;
        border-color: #bbdefb;
      }
      
      .smart-mapping-field-tag.measure {
        background: #fff3e0;
        color: #ef6c00;
        border-color: #ffcc80;
      }
      
      .smart-mapping-field-tag:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .smart-mapping-detected-field {
        transition: all 0.2s ease;
      }
      
      .smart-mapping-detected-field:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .smart-mapping-field-selector {
        transition: all 0.2s ease;
        max-width: 100%;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .smart-mapping-field-selector:focus {
        outline: none;
        border-color: #667eea !important;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
      }
      
      .smart-mapping-field-selector:hover {
        border-color: #667eea;
      }
      

      

      
      .smart-mapping-suggestions::-webkit-scrollbar {
        width: 6px;
      }
      
      .smart-mapping-suggestions::-webkit-scrollbar-track {
        background: #fff9c4;
        border-radius: 3px;
      }
      
      .smart-mapping-suggestions::-webkit-scrollbar-thumb {
        background: #d4af37;
        border-radius: 3px;
      }
      

      
      .smart-mapping-modal-footer {
        padding: 16px 24px;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .smart-mapping-validation {
        font-size: 12px;
        color: #6c757d;
      }
      
      .smart-mapping-actions {
        display: flex;
        gap: 8px;
      }
      
      .smart-mapping-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s ease;
      }
      
      .smart-mapping-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .smart-mapping-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }
      
      .smart-mapping-btn-secondary {
        background: #f8f9fa;
        color: #6c757d;
        border: 1px solid #e9ecef;
      }
      
      .smart-mapping-btn-secondary:hover {
        background: #e9ecef;
      }
      
      @media (max-width: 1400px) {
        .smart-mapping-modal-container {
          width: 98vw;
          height: 95vh;
        }
        
        .smart-mapping-modal-content {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr auto auto;
        }
        
        .smart-mapping-data-panel {
          border-top: 1px solid #e9ecef;
          border-left: none;
          border-right: none;
          max-height: 30vh;
        }
        
        .smart-mapping-fields-panel {
          border-top: 1px solid #e9ecef;
          max-height: 40vh;
        }
        
        .smart-mapping-prompts-panel {
          border-right: none;
        }
      }
      
      @media (max-width: 768px) {
        .smart-mapping-modal-container {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
        }
        
        .smart-mapping-modal-content {
          grid-template-columns: 1fr;
        }
        
        .smart-mapping-fields-panel {
          max-height: 50vh;
        }
      }
    </style>
  `;

        document.head.insertAdjacentHTML("beforeend", styles);
      }
      // ... other modal functions
      function setupSmartFieldMappingEvents() {
        // FIX: Remove existing listeners to prevent accumulation
        const clearBtn = document.getElementById("smartMappingClearAllBtn");
        const saveBtn = document.getElementById("smartMappingSaveBtn");
        const refreshBtn = document.getElementById("smartMappingRefreshBtn");
        const systemPrompt = document.getElementById("smartMappingSystemPrompt");
        const userPrompt = document.getElementById("smartMappingUserPrompt");
        const modal = document.getElementById("smartFieldMappingModal");

        // Remove existing listeners if they exist
        if (clearBtn && clearBtn.onclick) clearBtn.onclick = null;
        if (saveBtn && saveBtn.onclick) saveBtn.onclick = null;
        if (refreshBtn && refreshBtn.onclick) refreshBtn.onclick = null;

        // Add new listeners
        clearBtn?.addEventListener("click", handleClearAllMappings);
        saveBtn?.addEventListener("click", handleSave);
        refreshBtn?.addEventListener("click", handleRefreshFields);

        // Setup text selection handlers
        setupTextSelectionHandlers();

        // Prompt text changes
        systemPrompt?.addEventListener("input", handlePromptChange);
        userPrompt?.addEventListener("input", handlePromptChange);

        // Close on overlay click
        modal?.addEventListener("click", function (e) {
          if (e.target === this) {
            closeSmartFieldMappingModal();
          }
        });
      }

      function openSmartFieldMappingModal(data) {
        const modal = document.getElementById("smartFieldMappingModal");
        if (!modal) return;

        // Load current prompts
        const systemPrompt = data?.props?.systemPrompt || "";
        const userPrompt = data?.props?.userPrompt || "";

        document.getElementById("smartMappingSystemPrompt").value =
          systemPrompt;
        document.getElementById("smartMappingUserPrompt").value = userPrompt;

        // Load available fields from current layout
        loadAvailableFields();

        // Detect fields in current prompts
        detectAndDisplayFields();

        // Load saved field mappings if they exist
        const savedMappings = data?.props?.fieldMappings || [];

        setTimeout(() => {
          if (currentFieldSuggestions.length > 0) {
            // Apply saved mappings first
            if (savedMappings.length > 0) {
              currentFieldSuggestions.forEach((suggestion) => {
                const savedMapping = savedMappings.find(
                  (saved) => saved.placeholder === suggestion.placeholder
                );
                if (savedMapping && savedMapping.mappedField) {
                  suggestion.mappedField = savedMapping.mappedField;
                }
              });
            }

            // Then auto-apply high confidence mappings for any unmapped fields
            const highConfidenceSuggestions = currentFieldSuggestions.filter(
              (s) => s.confidence >= 80 && s.suggestedField && !s.mappedField
            );

            if (highConfidenceSuggestions.length > 0) {
              highConfidenceSuggestions.forEach((suggestion) => {
                suggestion.mappedField = suggestion.suggestedField.name;
              });
            }

            // Update displays
            updateDetectedFieldsList(currentFieldSuggestions);
            updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);
            updateMappingValidation();
          }
        }, 100);

        // Show modal
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
      }

      function closeSmartFieldMappingModal() {
        const modal = document.getElementById("smartFieldMappingModal");
        if (modal) {
          console.log("🔒 Closing Smart Field Mapping Modal");
          
          modal.classList.remove("active");
          document.body.style.overflow = "auto";
          
          // 🔧 CRITICAL FIX: Don't clear activeMappings here - they should persist!
          // activeMappings = []; // REMOVED: This was causing the green checkmarks to disappear
          selectedTextInfo = null;
          currentFieldSuggestions = [];
          
          // Hide field selector popup if open
          hideFieldSelector();
          
          console.log("✅ Modal closed, mappings preserved:", activeMappings.length);
        }
      }

      function loadAvailableFields() {
        const availableFields = getAvailableFields(layout);
        updateAvailableFieldsDisplay(availableFields);
      }

      function detectAndDisplayFields() {
        const systemPrompt =
          document.getElementById("smartMappingSystemPrompt")?.value || "";
        const userPrompt =
          document.getElementById("smartMappingUserPrompt")?.value || "";

        console.log("Detecting fields in prompts:", {
          systemPrompt: systemPrompt.length,
          userPrompt: userPrompt.length,
        });

        // Check if the prompts contain placeholders that match existing mappings
        const allPromptText = systemPrompt + " " + userPrompt;
        const existingPlaceholders = activeMappings.map((m) => m.placeholder);
        const foundPlaceholders = existingPlaceholders.filter((placeholder) =>
          allPromptText.includes(placeholder)
        );

        console.log("Existing mappings:", activeMappings.length);
        console.log("Found placeholders in text:", foundPlaceholders.length);

        // If we lost some mappings (user deleted text), remove them from active mappings
        if (foundPlaceholders.length < activeMappings.length) {
          const missingPlaceholders = existingPlaceholders.filter(
            (placeholder) => !allPromptText.includes(placeholder)
          );

          console.log(
            "Missing placeholders (removing from active mappings):",
            missingPlaceholders
          );

          // Remove mappings for placeholders that are no longer in the text
          activeMappings = activeMappings.filter((mapping) =>
            allPromptText.includes(mapping.placeholder)
          );

          console.log("Active mappings after cleanup:", activeMappings.length);
        }

        currentFieldSuggestions = updateFieldDetectionDisplay(
          systemPrompt,
          userPrompt
        );

        // Update validation status
        updateMappingValidation();
      }

      function handleAutoMap() {
        // Auto-map high confidence suggestions
        const autoMappable = currentFieldSuggestions.filter(
          (s) => s.confidence >= 80 && s.suggestedField && !s.mappedField
        );

        if (autoMappable.length === 0) {
          const alreadyMapped = currentFieldSuggestions.filter(
            (s) => s.mappedField
          ).length;
          if (alreadyMapped === currentFieldSuggestions.length) {
            alert("All fields are already mapped!");
          } else {
            alert(
              "No high-confidence matches found for auto-mapping. Please map fields manually using the dropdowns."
            );
          }
          return;
        }

        // Apply auto-mappings
        autoMappable.forEach((suggestion) => {
          suggestion.mappedField = suggestion.suggestedField.name;
        });

        // Update all displays
        updateDetectedFieldsList(currentFieldSuggestions);
        updateFieldStats(currentFieldSuggestions, currentFieldSuggestions);
        updateMappingValidation();

        // Show success message
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          const originalContent = validationDiv.innerHTML;
          const originalColor = validationDiv.style.color;

          validationDiv.innerHTML = `✨ Auto-mapped ${autoMappable.length} fields successfully!`;
          validationDiv.style.color = "#28a745";

          // Reset after 2 seconds
          setTimeout(() => {
            updateMappingValidation(); // Restore proper validation status
          }, 2000);
        }
      }

      // CORRECT handleSave function for Nebula.js extensions:
      // IMPROVED handleSave function that works better in Qlik Cloud:

      function handleSave() {
        const systemPrompt =
          document.getElementById("smartMappingSystemPrompt")?.value || "";
        const userPrompt =
          document.getElementById("smartMappingUserPrompt")?.value || "";

        // 🆕 VALIDATION: Require at least one prompt
        if (!systemPrompt.trim() && !userPrompt.trim()) {
          alert(
            "⚠️ Please add at least one prompt (System or User) before saving."
          );
          return;
        }

        // 🔧 FIXED: Use activeMappings instead of currentFieldSuggestions for validation
        const totalMappings = activeMappings.length; // This is the correct array to check
        const uniqueFields = new Set(activeMappings.map((m) => m.fieldName)).size;

        console.log("💾 Save validation:", {
          totalMappings,
          uniqueFields,
          activeMappings: activeMappings,
          activeMappingsLength: activeMappings.length
        });

        // 🔧 FIXED: Better validation logic
        if (totalMappings === 0) {
          // Only show this warning if there are actually detected fields but no mappings
          const systemPromptText = systemPrompt || "";
          const userPromptText = userPrompt || "";
          const allPromptText = systemPromptText + " " + userPromptText;
          const detectedPlaceholders = allPromptText.match(/\{\{[^}]+\}\}/g) || [];
          
          if (detectedPlaceholders.length > 0) {
            const proceed = confirm(
              `⚠️ Found ${detectedPlaceholders.length} field placeholders but no mappings created.\n\nYour prompts will be used as-is without field replacements.\n\nDo you want to save anyway?`
            );

            if (!proceed) {
              return;
            }
          }
          // If no placeholders detected at all, just proceed silently
        }

        // 🔧 IMPROVED: Use localStorage for session persistence + direct property update
        try {
          const fieldMappingsData = activeMappings.map((mapping) => ({
            placeholder: mapping.placeholder,
            fieldName: mapping.fieldName,
            mappedField: mapping.fieldName, // In Select Mode, fieldName is the mapped field
            originalText: mapping.originalText,
            source: mapping.source,
            fieldType: mapping.fieldType,
            confidence: 100, // Select Mode mappings are always 100% confident
            detectionMethod: "select_mode",
          }));

          console.log("💾 Saving field mappings data:", fieldMappingsData);

          // Save to localStorage for session persistence
          const saveData = {
            systemPrompt,
            userPrompt,
            fieldMappings: fieldMappingsData,
            timestamp: Date.now(),
            objectId: layout.qInfo?.qId,
          };

          localStorage.setItem(
            `dynamicLLM_${layout.qInfo?.qId}`,
            JSON.stringify(saveData)
          );

          // Also update layout properties directly for immediate use
          if (layout && layout.props) {
            layout.props.systemPrompt = systemPrompt;
            layout.props.userPrompt = userPrompt;
            layout.props.fieldMappings = fieldMappingsData;
          }

          // Show success message
          handleSaveSuccess(totalMappings, uniqueFields);

          console.log("✅ Configuration saved to localStorage and memory");
          console.log("✅ Saved mappings:", fieldMappingsData.length);

          // Inform user about persistence
          setTimeout(() => {
            const validationDiv = document.getElementById(
              "smartMappingValidation"
            );
            if (validationDiv) {
              validationDiv.innerHTML = `💾 Saved ${totalMappings} mappings to session! Settings will persist until browser refresh.`;
              validationDiv.style.color = "#2196f3";
            }
          }, 2000);
        } catch (error) {
          console.error("Save failed:", error);
          handleSaveError(error);
        }
      }

      // NEW: Function to load saved data on component initialization
      function loadSavedConfiguration() {
        try {
          const objectId = layout?.qInfo?.qId;
          if (!objectId) {
            console.log(
              "No object ID available for loading saved configuration"
            );
            return false;
          }

          const savedData = localStorage.getItem(`dynamicLLM_${objectId}`);
          if (!savedData) {
            console.log("No saved data found in localStorage");
            return false;
          }

          const data = JSON.parse(savedData);
          console.log("Found saved data:", data);

          // Check if data is recent (within 24 hours)
          const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
          if (!isRecent) {
            console.log("Saved data is too old, removing it");
            localStorage.removeItem(`dynamicLLM_${objectId}`);
            return false;
          }

          // Apply saved data to layout
          if (layout && layout.props) {
            layout.props.systemPrompt = data.systemPrompt || "";
            layout.props.userPrompt = data.userPrompt || "";
            layout.props.fieldMappings = data.fieldMappings || [];
            console.log("Applied saved data to layout props:", {
              systemPrompt: layout.props.systemPrompt,
              userPrompt: layout.props.userPrompt,
              fieldMappings: layout.props.fieldMappings,
            });
          }

          console.log("✅ Loaded saved configuration from localStorage");
          return true;
        } catch (error) {
          console.error("Failed to load saved configuration:", error);
          return false;
        }
      }

      // UPDATED: Enhanced openSmartFieldMappingModal to load from localStorage
      function openSmartFieldMappingModal(data) {
        const modal = document.getElementById("smartFieldMappingModal");
        if (!modal) return;

        // Debug: Show what's in localStorage
        const objectId = layout?.qInfo?.qId;
        console.log("Opening modal for object ID:", objectId);
        console.log("Data passed to modal:", data);
        console.log("Current layout props:", layout?.props);

        // Try to load from localStorage first, then fallback to data props
        const loadedFromStorage = loadSavedConfiguration();

        const systemPrompt =
          layout?.props?.systemPrompt || data?.props?.systemPrompt || "";
        const userPrompt =
          layout?.props?.userPrompt || data?.props?.userPrompt || "";

        document.getElementById("smartMappingSystemPrompt").value =
          systemPrompt;
        document.getElementById("smartMappingUserPrompt").value = userPrompt;

        // Load available fields from current layout
        loadAvailableFields();

        // Reset active mappings for fresh start
        activeMappings = [];
        selectedTextInfo = null;

        // Load saved field mappings and convert to active mappings
        const savedMappings =
          layout?.props?.fieldMappings || data?.props?.fieldMappings || [];

        console.log("Loading saved mappings:", savedMappings);

        if (savedMappings.length > 0) {
          // Convert saved mappings to active mappings format with proper ID generation
          activeMappings = savedMappings.map((saved, index) => {
            // Generate a unique ID that includes timestamp and index for better uniqueness
            const uniqueId = `mapping_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`;
            
            const mapping = {
              id: uniqueId,
              placeholder: saved.placeholder,
              fieldName: saved.mappedField || saved.fieldName,
              fieldType: saved.fieldType || "dimension", // Default if not specified
              originalText: saved.originalText || saved.fieldName,
              source: saved.source || "system",
              textareaId:
                saved.source === "user"
                  ? "smartMappingUserPrompt"
                  : "smartMappingSystemPrompt",
            };
            console.log(
              `✅ Converted saved mapping ${index}:`, 
              `${saved.placeholder} → ID: ${uniqueId}`
            );
            return mapping;
          });
          console.log("✅ Final active mappings with IDs:", activeMappings.map(m => ({ id: m.id, placeholder: m.placeholder })));
        } else {
          console.log("No saved mappings found to convert");
        }

        setTimeout(() => {
          console.log("⚙️ Setting up modal with active mappings:", activeMappings.length);

          // Setup all event handlers
          setupTextSelectionHandlers();
          setupDragDropHandlers();

          // 🔧 CRITICAL FIX: Update all displays in the correct order
          updateActiveMappingsDisplay();
          updateFieldTagStates(); // This should now show green checkmarks
          updateMappingStats(); // This should show correct numbers

          // Initial field detection to catch any existing placeholders
          detectAndDisplayFields();

          // Show status based on loaded mappings
          if (loadedFromStorage) {
            updateValidationMessage(
              "📂 Previous session data loaded automatically"
            );
            setTimeout(() => {
              updateValidationMessage(
                "Ready to create field mappings - select text in your prompts"
              );
            }, 3000);
          } else if (activeMappings.length > 0) {
            updateValidationMessage(
              `✅ Loaded ${activeMappings.length} saved mappings`
            );
            setTimeout(() => {
              updateValidationMessage(
                "Ready to create field mappings - select text in your prompts"
              );
            }, 3000);
          }

          console.log("✅ Modal setup complete");
        }, 300); // Increased delay to ensure everything is ready

        // Show modal
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
      }

      // ADD: Function to auto-load configuration when component initializes
      function initializeWithSavedData() {
        const loaded = loadSavedConfiguration();
        if (loaded) {
          console.log("🔄 Auto-loaded previous session configuration");
        }
      }

      // 3. ADD a cleanup function to manage localStorage (optional - for better memory management):
      function cleanupOldSavedData() {
        try {
          const keys = Object.keys(localStorage).filter((key) =>
            key.startsWith("dynamicLLM_")
          );
          keys.forEach((key) => {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              const isOld =
                Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000; // 7 days
              if (isOld) {
                localStorage.removeItem(key);
                console.log(`🧹 Cleaned up old saved data: ${key}`);
              }
            } catch (e) {
              localStorage.removeItem(key); // Remove corrupted data
            }
          });
        } catch (error) {
          console.error("Cleanup failed:", error);
        }
      }

      // ALSO UPDATE: The field replacement function to use the saved mappings
      const replaceDynamicFieldsEnhanced = (promptText, layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return promptText;
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];
        const measureInfo = layout.qHyperCube.qMeasureInfo || [];

        // Try to get saved mappings from layout props (which now includes localStorage data)
        const savedMappings = layout?.props?.fieldMappings || [];

        if (savedMappings.length > 0) {
          // Use saved mappings for precise field replacement
          let replacedPrompt = promptText;

          savedMappings.forEach((mapping) => {
            if (mapping.mappedField && mapping.placeholder) {
              // Find the mapped field in dimensions or measures
              let fieldValue = "";

              // Check dimensions
              const dimIndex = dimensionInfo.findIndex(
                (dim) => dim.qFallbackTitle === mapping.mappedField
              );

              if (dimIndex !== -1) {
                const values = matrix
                  .map(
                    (row) => row[dimIndex]?.qText || row[dimIndex]?.qNum || ""
                  )
                  .filter((v) => v !== "");
                const uniqueValues = [...new Set(values)];
                fieldValue = uniqueValues.slice(0, 5).join(", ");
              } else {
                // Check measures
                const measureIndex = measureInfo.findIndex(
                  (measure) => measure.qFallbackTitle === mapping.mappedField
                );

                if (measureIndex !== -1) {
                  const dimCount = dimensionInfo.length;
                  const values = matrix.map((row) => {
                    const val =
                      row[dimCount + measureIndex]?.qNum ||
                      row[dimCount + measureIndex]?.qText ||
                      0;
                    return parseFloat(val) || 0;
                  });
                  fieldValue = values
                    .slice(0, 5)
                    .map((v) => v.toString())
                    .join(", ");
                }
              }

              // Replace the placeholder with actual field value
              if (fieldValue) {
                const placeholderRegex = new RegExp(
                  mapping.placeholder.replace(/[{}]/g, "\\$&"),
                  "g"
                );
                replacedPrompt = replacedPrompt.replace(
                  placeholderRegex,
                  fieldValue
                );
              }
            }
          });

          return replacedPrompt;
        }

        // Fallback to original field replacement logic
        return replaceDynamicFields(promptText, layout);
      };
      // Fallback save method - directly modify layout properties
      function attemptFallbackSave(
        systemPrompt,
        userPrompt,
        mappedFields,
        totalFields
      ) {
        try {
          // Directly modify the layout properties (this might work in some Nebula.js contexts)
          if (layout && layout.props) {
            layout.props.systemPrompt = systemPrompt;
            layout.props.userPrompt = userPrompt;
            layout.props.fieldMappings = currentFieldSuggestions.map((s) => ({
              placeholder: s.placeholder,
              fieldName: s.fieldName,
              mappedField: s.mappedField || null,
              source: s.source,
              confidence: s.confidence,
              suggestedField: s.suggestedField?.name || null,
            }));

            // Show success message
            handleSaveSuccess(mappedFields, totalFields);

            console.log(
              "Fallback save completed - properties updated in memory"
            );
            console.log(
              "Note: Changes may not persist until object is saved through Qlik interface"
            );
          } else {
            throw new Error("Layout properties not accessible");
          }
        } catch (fallbackError) {
          console.error("Fallback save also failed:", fallbackError);
          handleSaveError(fallbackError);
        }
      }

      // Helper function for save success
      function handleSaveSuccess(mappedFields, totalFields) {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.innerHTML = `✅ Configuration saved successfully! ${mappedFields}/${totalFields} fields mapped.`;
          validationDiv.style.color = "#28a745";

          // Auto-close modal
          setTimeout(() => {
            closeSmartFieldMappingModal();
            // Force a re-render by calling the component's useEffect
            if (typeof window.forceRerender === "function") {
              window.forceRerender();
            }
          }, 1500);
        }
      }

      // Helper function for save errors
      function handleSaveError(error) {
        console.error("Save error:", error);
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.innerHTML = `❌ Error saving configuration: ${error.message}`;
          validationDiv.style.color = "#dc3545";
        }

        // Show a more user-friendly error message
        alert(
          `❌ Unable to save configuration automatically.\n\nThis may be due to Qlik security restrictions.\n\nAs a workaround:\n1. Copy your prompts to a text file\n2. Close this modal\n3. Re-open the modal and paste your prompts\n4. Reconfigure field mappings\n\nThe extension will work with your settings during this session.`
        );
      }

      // ALSO ADD: Enhanced field replacement that uses saved mappings with actual field names
      const replaceDynamicFieldsWithMappings = (promptText, layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          console.log("No data available for field replacement");
          return promptText;
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];
        const measureInfo = layout.qHyperCube.qMeasureInfo || [];
        const props = layout?.props || {};

        // Use saved field mappings if available
        const savedMappings = props.fieldMappings || [];
        console.log("🔍 Processing field mappings:", savedMappings.length);

        if (savedMappings.length > 0) {
          let replacedPrompt = promptText;

          savedMappings.forEach((mapping) => {
            if (mapping.mappedField && mapping.placeholder) {
              console.log(`🔍 Processing mapping: ${mapping.placeholder} → ${mapping.mappedField}`);
              
              let fieldValue = "";

              // Check dimensions - look for actual field name in expression OR display name
              const dimIndex = dimensionInfo.findIndex((dim) => {
                const actualFieldName = dim.qGroupFieldDefs?.[0] || dim.qFallbackTitle;
                return (
                  actualFieldName === mapping.mappedField ||
                  dim.qFallbackTitle === mapping.mappedField
                );
              });

              if (dimIndex !== -1) {
                const values = matrix
                  .map((row) => row[dimIndex]?.qText || row[dimIndex]?.qNum || "")
                  .filter((v) => v !== "" && v !== "-" && v !== null && v !== undefined);
                const uniqueValues = [...new Set(values)];
                fieldValue = uniqueValues.slice(0, 5).join(", ");
                if (!fieldValue || fieldValue.trim() === "") {
                  fieldValue = "No data available";
                }
                console.log(`✅ Found dimension data for '${mapping.mappedField}': ${fieldValue}`);
              } else {
                // Check measures - look for actual field name in expression OR display name
                const measureIndex = measureInfo.findIndex((measure) => {
                  const expression = measure.qDef?.qDef || measure.qFallbackTitle;
                  // Extract actual field name from expression
                  let actualFieldName = expression;
                  const fieldMatch = expression.match(/\[([^\]]+)\]/);
                  if (fieldMatch) {
                    actualFieldName = fieldMatch[1];
                  } else {
                    const aggMatch = expression.match(
                      /(?:sum|avg|count|max|min|total)\s*\(\s*([^)]+)\s*\)/i
                    );
                    if (aggMatch) {
                      actualFieldName = aggMatch[1].replace(/['"]/g, "").trim();
                    }
                  }
                  return (
                    actualFieldName === mapping.mappedField ||
                    measure.qFallbackTitle === mapping.mappedField
                  );
                });

                if (measureIndex !== -1) {
                  const dimCount = dimensionInfo.length;
                  const values = matrix.map((row) => {
                    const val =
                      row[dimCount + measureIndex]?.qNum ||
                      row[dimCount + measureIndex]?.qText ||
                      0;
                    return parseFloat(val) || 0;
                  });
                  fieldValue = values
                    .slice(0, 5)
                    .map((v) => v.toString())
                    .join(", ");
                  if (!fieldValue || fieldValue.trim() === "" || fieldValue === "0, 0, 0, 0, 0") {
                    fieldValue = "No data available";
                  }
                  console.log(`✅ Found measure data for '${mapping.mappedField}': ${fieldValue}`);
                }
              }

              // Replace the placeholder with actual field value (always replace, even with "No data available")
              if (fieldValue !== "") {
                const placeholderRegex = new RegExp(
                  mapping.placeholder.replace(/[{}]/g, "\\$&"),
                  "g"
                );
                replacedPrompt = replacedPrompt.replace(
                  placeholderRegex,
                  fieldValue || "No data available"
                );
                console.log(`🔄 Replaced ${mapping.placeholder} with: ${fieldValue}`);
              }
            }
          });

          console.log("✅ Field replacement complete");
          return replacedPrompt;
        }

        // Fallback to original field replacement logic
        console.log("📝 Using fallback field replacement");
        return replaceDynamicFields(promptText, layout);
      };

      // FIXED: Robust expression building with proper escaping
      const buildLLMExpression = (fullPrompt, props) => {
        console.log("🏗️ Building LLM expression (ultra-safe approach)...");
        
        // Step 1: Validate inputs
        const connectionName = String(props.connectionName || '').trim();
        if (!connectionName) {
          throw new Error("Connection name is required");
        }
        
        // Step 2: Clean prompt - be more aggressive about removing problematic characters
        let cleanPrompt = String(fullPrompt || '')
          .trim()
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Control chars
          .replace(/'/g, "'")       // Normalize quotes  
          .replace(/"/g, '"')       // Normalize double quotes
          .replace(/\r\n/g, '\n')   // Normalize line endings
          .replace(/\r/g, '\n');
        
        if (!cleanPrompt) {
          throw new Error("Prompt is empty after cleaning");
        }
        
        console.log("📝 Cleaned prompt length:", cleanPrompt.length);
        
        // Step 3: Build config with safe numeric values
        const temperature = Math.max(0, Math.min(2, Number(props.temperature || 0.7)));
        const topK = Math.max(1, Math.min(1000, Number(props.topK || 250)));
        const topP = Math.max(0, Math.min(1, Number(props.topP || 1)));
        const maxTokens = Math.max(1, Math.min(4000, Number(props.maxTokens || 1000)));
        
        // Step 4: Use the simplest possible approach that works - include all parameters
        const configStr = `{"RequestType":"endpoint","endpoint":{"connectionname":"${connectionName.replace(/"/g, '\\"')}","column":"text","parameters":{"temperature":${temperature},"Top K":${topK},"Top P":${topP},"max_tokens":${maxTokens}}}}`;
        
        // Step 5: Use double single quotes for Qlik string escaping
        const escapedPrompt = cleanPrompt.replace(/'/g, "''");
        
        // Step 6: Build expression
        const expression = `endpoints.ScriptEvalStr('${configStr}', '${escapedPrompt}')`;
        
        console.log("🔒 Using ultra-safe Qlik escaping approach");
        console.log("🔍 Config string:", configStr.substring(0, 100) + "...");
        console.log("🔍 Escaped prompt preview:", escapedPrompt.substring(0, 100) + "...");
        console.log("✅ Expression built successfully, length:", expression.length);
        console.log("🔍 Expression preview:", expression.substring(0, 200) + "...");
        
        return expression;
      };

      // Helper function for save success
      function handleSaveSuccess(totalMappings, uniqueFields) {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.innerHTML = `✅ Configuration saved successfully! ${totalMappings} mappings using ${uniqueFields} fields.`;
          validationDiv.style.color = "#28a745";

          // Auto-close modal
          setTimeout(() => {
            closeSmartFieldMappingModal();
            // Layout will automatically re-render with new data
          }, 1500);
        }
      }

      // Helper function for save errors
      function handleSaveError(error) {
        console.error("Save error:", error);
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.innerHTML = `❌ Error saving configuration: ${error.message}`;
          validationDiv.style.color = "#dc3545";
        }
        alert(
          `❌ Failed to save configuration:\n\n${error.message}\n\nPlease check the console for more details.`
        );
      }

      function handlePromptChange(event) {
        console.log("Prompt content changed:", event?.target?.id);

        // Use debouncing to avoid too many updates while typing
        clearTimeout(window.promptChangeTimeout);
        window.promptChangeTimeout = setTimeout(() => {
          console.log("Processing prompt change...");

          // Real-time field detection as user types/pastes
          detectAndDisplayFields();

          // Update displays to reflect any changes
          updateActiveMappingsDisplay();
          updateFieldTagStates();
          updateMappingStats();

          console.log("Prompt change processing complete");
        }, 300); // 300ms debounce
      }

      async function handleRefreshFields() {
        try {
          // Show loading state immediately
          const refreshBtn = document.getElementById("smartMappingRefreshBtn");
          if (refreshBtn) {
            refreshBtn.textContent = "Refreshing...";
            refreshBtn.style.background = "#ffc107";
            refreshBtn.disabled = true;
          }

          console.log("🔄 Starting field refresh...");
          console.log("Current layout before refresh:", layout);

          // Get the fresh layout from the current object with timeout
          const currentObject = await app.getObject(layout.qInfo.qId);
          const freshLayout = await Promise.race([
            currentObject.getLayout(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 5000)
            ),
          ]);

          console.log("Fresh layout received:", freshLayout);

          // Update global layout reference - THIS IS CRITICAL
          layout = freshLayout;

          // Force refresh the available fields from the updated layout
          const availableFields = getAvailableFields(freshLayout);
          console.log("Available fields after refresh:", availableFields);

          updateAvailableFieldsDisplay(availableFields);

          // Update existing mappings with new field names if they exist
          updateMappingsWithNewFieldNames(availableFields);

          // CRITICAL: Refresh all displays in the correct order
          setTimeout(() => {
            console.log("Updating all displays after refresh...");
            updateActiveMappingsDisplay();
            updateFieldTagStates(); // This was missing the proper timing
            updateMappingStats();

            // Re-setup drag-drop handlers for new field tags
            setupDragDropHandlers();

            // If field selector is open, refresh it too
            const fieldSelectorPopup =
              document.getElementById("fieldSelectorPopup");
            if (
              fieldSelectorPopup &&
              fieldSelectorPopup.style.display !== "none"
            ) {
              populateFieldSelectorOptions();
            }

            console.log("✅ All displays updated after refresh");
          }, 100);

          // Show success feedback
          if (refreshBtn) {
            refreshBtn.textContent = "Refreshed!";
            refreshBtn.style.background = "#28a745";
            refreshBtn.disabled = false;

            setTimeout(() => {
              refreshBtn.textContent = "Refresh";
              refreshBtn.style.background = "#17a2b8";
            }, 1000);
          }

          updateValidationMessage(
            "✅ Fields refreshed - existing mappings updated"
          );
          setTimeout(() => {
            updateValidationMessage(
              "Ready to create field mappings - select text in your prompts"
            );
          }, 3000);

          console.log("✅ Fields refreshed with latest layout");
        } catch (error) {
          console.error("Error refreshing fields:", error);

          // Fallback to old method (faster) but still update displays
          const availableFields = getAvailableFields(layout);
          updateAvailableFieldsDisplay(availableFields);
          updateFieldTagStates(); // Make sure this is called even in fallback

          // Show error feedback
          const refreshBtn = document.getElementById("smartMappingRefreshBtn");
          if (refreshBtn) {
            refreshBtn.textContent = "Try Again";
            refreshBtn.style.background = "#dc3545";
            refreshBtn.disabled = false;

            setTimeout(() => {
              refreshBtn.textContent = "Refresh";
              refreshBtn.style.background = "#17a2b8";
            }, 2000);
          }
        }
      }

      // ===== END MODAL FUNCTIONS =====

      // Main effect hook - Re-run when layout changes (selections, filters, etc.)
      useEffect(() => {
        if (!element) return;

        // NEW: Auto-load saved configuration when component initializes
        initializeWithSavedData();
        cleanupOldSavedData();
        const render = async () => {
          const props = layout?.props || {};

          // Get validation result
          const validation = await validateSelections(layout, app);
          const selectionInfo = getDynamicSelectionInfo(layout, validation);

          // Base font styles that will be applied globally
          const baseFontStyle = `
              font-size: ${props.fontSize || 14}px;
              font-weight: ${props.fontWeight || "normal"};
              font-style: ${props.fontStyle || "normal"};
              color: ${props.fontColor || "#212529"};
          `;

          // Apply custom styling
          const headerStyle = `
            background: #ffffff;
            padding: 10px;
            border-radius: 8px 8px 0 0;
            margin: 0;
            ${baseFontStyle}
          `;

          const responseStyle = `
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 16px;
          text-align: left;
          line-height: 1.5;
          margin: 0;
          word-wrap: break-word;
          overflow-wrap: break-word;
          ${baseFontStyle}
          `;

          const buttonStyle = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: ${Math.max(12, (props.fontSize || 14) - 1)}px;
          font-weight: ${props.fontWeight === "bold" ? "bold" : "600"};
          font-style: ${props.fontStyle || "normal"};
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          `;

          // Build header
          // And update the header div to remove extra margins and padding:

          let content = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff; min-height: 200px; margin: 0; padding: 0;position: relative;top: 0;left: 0; ${baseFontStyle}">
                <div style="display: flex; align-items: center; justify-content: space-between; margin: 0;  padding: 10px;padding-bottom: 8px;  border-bottom: 1px solid #e0e0e0; background: #ffffff; flex-wrap: wrap;gap: 8px;position: relative;top: 0;">
                  <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                    <span style="font-size: 20px; margin-right: 8px; flex-shrink: 0;">🤖</span>
                    <div style="min-width: 0; flex: 1;">
                      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">AI Analysis</h2>
                      ${
                        selectionInfo
                          ? `<p style="margin: 2px 0 0 0; font-size: 12px; opacity: 0.7; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${selectionInfo}</p>`
                          : ""
                      }
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            `;
          // Add button based on configuration and validation state
          if (
            !props.connectionName ||
            !props.systemPrompt ||
            !props.userPrompt
          ) {
            const missingItems = [];
            if (!props.connectionName) missingItems.push("Connection");
            if (!props.systemPrompt || !props.userPrompt)
              missingItems.push("Prompts");

            content += `
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 6px 10px; font-size: 11px; color: #856404; white-space: nowrap;">
                ⚙️ Setup: ${missingItems.join(", ")}
              </div>
            `;
          } else if (!validation.valid) {
            content += `
              <button disabled style="background: #e9ecef; color: #6c757d; border-radius: ${
                props.borderRadius || 8
              }px; padding: 8px 12px; font-size: 11px; font-weight: 600; border: none; cursor: not-allowed; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                <span>⚠️</span>
                Selection Required
              </button>
            `;
          } else {
            content += `
              <button id="generateButton" style="${buttonStyle} box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 14px;">✨</span>
                <span>Generate Analysis</span>
              </button>
            `;
          }

          content += `</div></div>`;

          // Main content area
          if (
            !props.connectionName ||
            !props.systemPrompt ||
            !props.userPrompt
          ) {
            // Enhanced Configuration needed with step-by-step guidance
            const hasConnection = !!props.connectionName;
            const hasValidation = !!props.enableCustomValidation && !!props.customValidationExpression && props.customValidationExpression.trim() !== "";
            const hasData = !!(
              layout.qHyperCube?.qDimensionInfo?.length ||
              layout.qHyperCube?.qMeasureInfo?.length
            );
            const hasPrompts = !!(props.systemPrompt && props.userPrompt);

            content += `
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 8px;">
                  <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.4;"></div>
                  <h3 style="margin: 0 0 6px 0; color: #495057; font-size: 18px; font-weight: 600;">Welcome to Dynamic LLM Extension</h3>
                  <p style="margin: 0; font-size: 14px; color: #6c757d;">Follow these steps to get started with AI-powered data analysis</p>
                </div>

                <!-- Step-by-step setup -->
                <div style="max-width: 500px; margin: 0 auto; width: 100%;">
                  
                  <!-- Step 1: Connection -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${
                    hasConnection ? "#e8f5e8" : "#fff3e0"
                  }; border: 1px solid ${
              hasConnection ? "#c3e6c3" : "#ffcc80"
            }; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${
                      hasConnection ? "#28a745" : "#ff9800"
                    }; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasConnection ? "✓" : "1"}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${
                        hasConnection ? "#155724" : "#e65100"
                      };">
                        ${
                          hasConnection
                            ? "Connection Configured ✓"
                            : "Configure Claude Connection"
                        }
                      </div>
                      <div style="font-size: 11px; color: ${
                        hasConnection ? "#155724" : "#e65100"
                      }; opacity: 0.8;">
                        ${
                          hasConnection
                            ? "Ready to connect to Claude AI"
                            : "Set connection name in LLM Configuration panel"
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Step 2: Validation -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${
                    hasValidation ? "#e8f5e8" : "#fff3e0"
                  }; border: 1px solid ${
              hasValidation ? "#c3e6c3" : "#ffcc80"
            }; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${
                      hasValidation ? "#28a745" : "#ff9800"
                    }; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasValidation ? "✓" : "2"}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${
                        hasValidation ? "#155724" : "#e65100"
                      };">
                        ${
                          hasValidation
                            ? "Validation Configured ✓"
                            : "Setup Selection Validation"
                        }
                      </div>
                      <div style="font-size: 11px; color: ${
                        hasValidation ? "#155724" : "#e65100"
                      }; opacity: 0.8;">
                        ${
                          hasValidation
                            ? "Custom validation rules are active"
                            : "Enable validation in Selection Validation panel"
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Step 3: Data -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${
                    hasData ? "#e8f5e8" : "#fff3e0"
                  }; border: 1px solid ${
              hasData ? "#c3e6c3" : "#ffcc80"
            }; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${
                      hasData ? "#28a745" : "#ff9800"
                    }; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasData ? "✓" : "3"}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${
                        hasData ? "#155724" : "#e65100"
                      };">
                        ${
                          hasData
                            ? "Data Fields Added ✓"
                            : "Add Dimensions & Measures"
                        }
                      </div>
                      <div style="font-size: 11px; color: ${
                        hasData ? "#155724" : "#e65100"
                      }; opacity: 0.8;">
                        ${
                          hasData
                            ? `${
                                layout.qHyperCube?.qDimensionInfo?.length || 0
                              } dimensions, ${
                                layout.qHyperCube?.qMeasureInfo?.length || 0
                              } measures`
                            : "Add data fields in the Data panel"
                        }
                      </div>
                    </div>
                                  </div>

                <!-- Step 4: Prompts -->
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${
                  hasPrompts ? "#e8f5e8" : "#fff3e0"
                }; border: 1px solid ${
              hasPrompts ? "#c3e6c3" : "#ffcc80"
            }; border-radius: 8px;">
                  <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${
                    hasPrompts ? "#28a745" : "#ff9800"
                  }; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                    ${hasPrompts ? "✓" : "4"}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 13px; color: ${
                      hasPrompts ? "#155724" : "#e65100"
                    };">
                      ${hasPrompts ? "Prompts Configured ✓" : "Add AI Prompts"}
                    </div>
                    <div style="font-size: 11px; color: ${
                      hasPrompts ? "#155724" : "#e65100"
                    }; opacity: 0.8;">
                      ${
                        hasPrompts
                          ? "System and user prompts are ready"
                          : 'Click "Configure Prompts & Field Mapping" to add prompts'
                      }
                    </div>
                  </div>
                </div>

                </div>

                <!-- Action Button -->
                <div style="text-align: center; margin-top: 24px;">
                  <button id="openSmartMappingBtn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 auto;
                  ">
                    <span style="font-size: 16px;">🎯</span>
                    <span>Configure Prompts & Field Mapping</span>
                  </button>
                </div>


              </div>
            `;
          } else {
            // Show main interface
            content += `<div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">`;

            if (!validation.valid) {
              content += generateValidationErrorHTML(validation, props);
            } else {
              // Ready state
              content += `
                 <div id="llmResponse" style="flex: 1;${responseStyle} text-align: left; min-height: 180px; height: 280px; border: 1px solid #d4edda; background: #f8fff9; scrollbar-width: thin; scrollbar-color: #9ca3af #f1f3f4;">
                 <div style="padding: 16px; color: #155724; text-align: center;">
                 <h3 style="margin: 0 0 12px 0; color: inherit; font-size: 16px; font-weight: 600;">Ready to Analyze</h3>
                  <p style="margin: 0; opacity: 0.8; font-size: 13px; line-height: 1.4;">
                     Click the generate button above to start AI analysis
                  </p>
                </div>
                </div>
              `;
            }

            content += `</div>`;
          }

          content += `</div>`;

          // Set HTML and add styles
          element.innerHTML = content;

          // Add CSS
          const style = document.createElement("style");
          style.textContent = `
           /* Remove any default margins/padding that might affect positioning */
            .qv-object-dynamicLLM {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .qv-object-dynamicLLM > div:first-child {
              margin-top: 0 !important;
              padding-top: 0 !important;
            }

            /* Override the 28px height that's causing the extra space */
            .qv-object-header.thin {
              height: 0px !important;
              min-height: 0px !important;
              padding: 0 !important;
              margin: 0 !important;
              display: none !important;
            }

            .qv-object-dynamicLLM .qv-object-content-container {
              margin: 0 !important;
              padding: 0 !important;
              top: 0 !important;
            }

            /* Hide any Qlik object header elements */
            .qv-object-dynamicLLM .qv-object-header {
              display: none !important;
              height: 0 !important;
            }
          #generateButton:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5) !important;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            #llmResponse::-webkit-scrollbar {
              width: 12px;
            }
            #llmResponse::-webkit-scrollbar-track {
              background: #f1f3f4;
              border-radius: 6px;
              margin: 4px;
            }
            #llmResponse::-webkit-scrollbar-thumb {
              background: #9ca3af;
              border-radius: 6px;
              border: 2px solid #f1f3f4;
            }
            #llmResponse::-webkit-scrollbar-thumb:hover {
              background: #6b7280;
            }
            
            #openSmartMappingBtn:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
            }
          `;
          document.head.appendChild(style);

          // UPDATED: Enhanced handleGenerate function with better error handling
          const handleGenerate = async () => {
            const validation = await validateSelections(layout, app);
            const responseDiv = element.querySelector("#llmResponse");
            const generateButton = element.querySelector("#generateButton");

            if (!validation.valid) {
              if (responseDiv) {
                responseDiv.innerHTML = generateValidationErrorHTML(validation, props);
              }
              return;
            }

            // Disable button and show loading
            if (generateButton) {
              generateButton.disabled = true;
              generateButton.style.background = "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)";
              generateButton.innerHTML = `<span style="margin-right: 6px;">⏳</span><span>Analyzing...</span>`;
            }

            if (responseDiv) {
              responseDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; color: #6c757d; padding: 20px; text-align: center;">
                  <div style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
                  <p style="margin: 0; font-size: 14px;">Analyzing your data...</p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">Processing with Claude AI</p>
                </div>
              `;
            }

            try {
              // Step 1: Get and process prompts
              let systemPrompt = props.systemPrompt || "";
              let userPrompt = props.userPrompt || "";

              console.log("🔍 Original prompts:", { 
                systemPrompt: systemPrompt.substring(0, 100) + "...", 
                userPrompt: userPrompt.substring(0, 100) + "..." 
              });

              // Step 2: Replace dynamic fields using the enhanced function
              systemPrompt = replaceDynamicFieldsWithMappings(systemPrompt, layout);
              userPrompt = replaceDynamicFieldsWithMappings(userPrompt, layout);

              console.log("🔍 After field replacement:", { 
                systemPrompt: systemPrompt.substring(0, 100) + "...", 
                userPrompt: userPrompt.substring(0, 100) + "..." 
              });

              // Step 3: Build full prompt
              let fullPrompt = userPrompt;
              if (systemPrompt && systemPrompt.trim()) {
                fullPrompt = systemPrompt + "\n\n" + userPrompt;
              }

                          // Step 4: Add data context if available (SIMPLIFIED to avoid size issues)
            if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
              const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
              
              // Only add a small sample of data to keep prompt size manageable
              fullPrompt += "\n\nData Sample:\n";
              
              // Add just the first few rows as context
              const maxRows = Math.min(matrix.length, 10); // Reduced to just 10 rows
              matrix.slice(0, maxRows).forEach((row, idx) => {
                const rowData = row.map((cell) => cell.qText || cell.qNum || "").join(", ");
                fullPrompt += `Row ${idx + 1}: ${rowData}\n`;
              });

              if (matrix.length > maxRows) {
                fullPrompt += `... and ${matrix.length - maxRows} more rows available\n`;
              }
            }

              console.log("📝 Final prompt length:", fullPrompt.length);
              console.log("🔍 Final prompt preview:", fullPrompt.substring(0, 300) + "...");

              // Step 5: Validate prompt length and truncate if needed
              if (fullPrompt.length > 50000) { // More conservative limit
                console.warn("⚠️ Prompt is large, truncating...");
                fullPrompt = fullPrompt.substring(0, 45000) + "\n\n[Note: Content truncated due to size limits]";
              }

                      // Step 6: Build and validate expression
        const expression = buildLLMExpression(fullPrompt, props);
        
        // FIX: Validate expression size to prevent browser crashes
        if (expression.length > 1000000) { // 1MB limit
          throw new Error("Expression too large (over 1MB). Please reduce prompt or data size.");
        }

              // Step 7: Execute with timeout
              console.log("🚀 Executing expression...");
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timeout after 30 seconds")), 30000)
              );
              
              const evaluatePromise = app.evaluate({ qExpression: expression });
              
              const response = await Promise.race([evaluatePromise, timeoutPromise]);
              
              console.log("📥 Raw response from Qlik:", response);
              
              // Step 8: Process response
              let responseText = "";
              if (response && typeof response === "object") {
                responseText = response.qText || response.qNum?.toString() || JSON.stringify(response);
              } else if (response) {
                responseText = response.toString();
              }

              if (!responseText || responseText.trim() === "") {
                throw new Error("Empty response received from LLM service");
              }

              // Check for Qlik expression errors
              if (responseText.includes("Error in expression") || 
                  responseText.includes("') expected") ||
                  responseText.includes("Syntax error")) {
                throw new Error("Qlik expression error: " + responseText);
              }

              console.log("✅ Final response text:", responseText.substring(0, 200) + "...");

              // Step 9: Display result
              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="word-wrap: break-word; line-height: 1.6; text-align: left; padding: 12px; overflow-y: auto; height: 300px; scrollbar-width: thin; scrollbar-color: #9ca3af #f1f3f4;" class="analysis-content">
                    <div style="white-space: pre-wrap;">${responseText.replace(/\n/g, "<br>")}</div>
                  </div>
                `;
              }

            } catch (err) {
              console.error("❌ LLM Error:", err);
              console.error("❌ Error stack:", err.stack);

              // Enhanced error handling
              let errorMessage = "Failed to generate response";
              let errorDetails = "";

              if (err.message) {
                if (err.message.includes("') expected")) {
                  errorMessage = "Expression syntax error";
                  errorDetails = "There's a syntax issue in the generated expression. This usually happens with special characters in prompts.";
                } else if (err.message.includes("timeout")) {
                  errorMessage = "Request timed out";
                  errorDetails = "The AI service took too long to respond. Please try again.";
                } else if (err.message.includes("Connection")) {
                  errorMessage = "Connection error";
                  errorDetails = "Check your connection name and ensure the Claude SSE endpoint is properly configured.";
                } else {
                  errorMessage = err.message;
                  errorDetails = "Check the browser console for more details.";
                }
              }

              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; color: #dc2626; text-align: left; line-height: 1.5; font-size: 13px; word-wrap: break-word; overflow-wrap: break-word;">
                    <div style="font-weight: 600; margin-bottom: 4px;">⚠️ ${errorMessage}</div>
                    <div style="margin-bottom: 8px;">${errorDetails}</div>
                    <details style="margin-top: 8px;">
                      <summary style="cursor: pointer; font-size: 11px; opacity: 0.8;">Technical Details</summary>
                      <div style="margin-top: 4px; font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; overflow-wrap: break-word;">
                        ${err.message || "Unknown error"}
                      </div>
                    </details>
                  </div>
                `;
              }
            } finally {
              // Complete button state
              if (generateButton) {
                generateButton.disabled = true;
                generateButton.style.background = "#e9ecef";
                generateButton.style.color = "#6c757d";
                generateButton.style.cursor = "not-allowed";
                generateButton.style.boxShadow = "none";
                generateButton.innerHTML = '<span style="font-size: 14px;">✅</span><span>Analysis Complete</span>';
              }
            }
          };

          // Add event listener
          const generateButton = element.querySelector("#generateButton");
          if (generateButton) {
            generateButton.onclick = handleGenerate;
          }

          // Add Smart Mapping button event listener
          const openSmartMappingBtn = element.querySelector(
            "#openSmartMappingBtn"
          );
          if (openSmartMappingBtn) {
            openSmartMappingBtn.onclick = () => {
              openSmartFieldMappingModal({ props: layout?.props || {} });
            };
          }

          // NEW: Add modal to the page - FIX: Prevent duplicate creation
          if (!document.getElementById("smartFieldMappingModal")) {
            createSmartFieldMappingModal();
          }
        };

        render();
      }, [element, layout, app]); // This will re-run whenever layout changes (including filter selections)
    },
  };
}

