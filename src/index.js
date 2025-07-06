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
          source: systemPrompt && systemPrompt.includes(match[0]) ? "system" : "user",
          detectionMethod: "traditional",
          autoMappable: true
        }));

        return detectedFields;
      }

      // Get available fields from current layout
      function getAvailableFields(layout) {
        console.log('🔍 getAvailableFields called with layout:', layout);
        const dimensions = layout?.qHyperCube?.qDimensionInfo || [];
        const measures = layout?.qHyperCube?.qMeasureInfo || [];

        console.log('🔍 Raw dimensions:', dimensions);
        console.log('🔍 Raw measures:', measures);

        const result = {
          dimensions: dimensions.map((dim) => ({
            name: dim.qFallbackTitle,
            type: "dimension",
            expression: dim.qGroupFieldDefs?.[0] || dim.qFallbackTitle,
          })),
          measures: measures.map((measure) => ({
            name: measure.qFallbackTitle,
            type: "measure",
            expression: measure.qDef?.qDef || measure.qFallbackTitle,
          })),
        };

        console.log('🔍 Processed result:', result);
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
            const exactMatch = [...availableFields.dimensions, ...availableFields.measures]
              .find(field => field.name.toLowerCase() === fieldName);

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
              keepAsText: false // Option to keep as normal text
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
            keepAsText: false
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
                        ? `Smart detection: Found "${suggestion.fieldName}" field → ${suggestion.suggestedReplacement || suggestion.placeholder}`
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
                          background: ${suggestion.mappedField ? '#28a745' : '#007bff'};
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
                        ${suggestion.mappedField ? '✓ Mapped to Field' : '🔗 Map to Field'}
                      </button>
                      <button 
                        onclick="keepAsText(${index})"
                        style="
                          flex: 1;
                          background: ${suggestion.keepAsText ? '#6c757d' : '#f8f9fa'};
                          color: ${suggestion.keepAsText ? 'white' : '#6c757d'};
                          border: 1px solid #dee2e6;
                          padding: 6px 8px;
                          border-radius: 4px;
                          font-size: 10px;
                          cursor: pointer;
                          font-weight: 500;
                        "
                        title="Keep as normal text"
                      >
                        ${suggestion.keepAsText ? '✓ Keep as Text' : '📝 Keep as Text'}
                      </button>
                    </div>
                  </div>
                  `
                    : ""
                }
                
                <div style="display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box;">
                  <span style="font-size: 10px; color: #6c757d; font-weight: 600; flex-shrink: 0; white-space: nowrap;">
                    ${suggestion.detectionMethod === "intelligent" ? "Override:" : "Map to:"}
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
                      ${suggestion.detectionMethod === "intelligent" ? 'opacity: 0.7;' : ''}
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

      // Update mapping validation status
      function updateMappingValidation() {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (!validationDiv) return;

        const totalFields = currentFieldSuggestions.length;
        const mappedFields = currentFieldSuggestions.filter(
          (s) => s.mappedField
        ).length;
        const keptAsText = currentFieldSuggestions.filter(
          (s) => s.keepAsText
        ).length;
        const resolvedFields = mappedFields + keptAsText;

        if (totalFields === 0) {
          validationDiv.innerHTML =
            "Add field references to your prompts (use field names naturally or {{field}} syntax) for smart mapping";
          validationDiv.style.color = "#6c757d";
        } else if (resolvedFields === 0) {
          validationDiv.innerHTML = `⚠️ ${totalFields} fields need action (map or keep as text)`;
          validationDiv.style.color = "#ffc107";
        } else if (resolvedFields < totalFields) {
          validationDiv.innerHTML = `⚠️ ${resolvedFields}/${totalFields} fields resolved - ${
            totalFields - resolvedFields
          } remaining (${mappedFields} mapped, ${keptAsText} as text)`;
          validationDiv.style.color = "#ffc107";
        } else {
          validationDiv.innerHTML = `✅ All ${totalFields} fields resolved and ready to save (${mappedFields} mapped, ${keptAsText} as text)`;
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
              <div class="smart-mapping-field-tag dimension" data-field="${dim.name}" data-type="dimension">
                ${dim.name}
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
              <div class="smart-mapping-field-tag measure" data-field="${measure.name}" data-type="measure">
                ${measure.name}
              </div>
            `
              )
              .join("");
          }
        }
      }



      // Store current suggestions globally for access by other functions
      let currentFieldSuggestions = [];

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
                    </div>
                    <div class="smart-mapping-prompt-container" style="position: relative;">
                      <textarea id="smartMappingSystemPrompt" class="smart-mapping-textarea" 
                                placeholder="Enter your system prompt. Reference field names naturally or use {{field}} placeholders..."></textarea>
                      <div id="systemPromptOverlay" class="prompt-overlay"></div>
                    </div>
                  </div>
                  
                  <div class="smart-mapping-prompt-section">
                    <div class="smart-mapping-prompt-header">
                      User Prompt
                    </div>
                    <div class="smart-mapping-prompt-container" style="position: relative;">
                      <textarea id="smartMappingUserPrompt" class="smart-mapping-textarea" 
                                placeholder="Enter your user prompt. Reference field names naturally or use {{field}} placeholders..."></textarea>
                      <div id="userPromptOverlay" class="prompt-overlay"></div>
                    </div>
                  </div>
                </div>
                
                <!-- Right Panel: Detected Fields & Suggestions -->
                <div class="smart-mapping-results-panel">
                  <!-- Detected Fields -->
                  <div class="smart-mapping-section large-section">
                    <div class="smart-mapping-section-header">
                      <div class="smart-mapping-header-content">
                        <span class="smart-mapping-header-title">Detected Fields</span>
                        <div class="smart-mapping-toolbar">
                          <button id="smartMappingAutoMapBtn" class="smart-mapping-toolbar-btn primary">
                            <span class="btn-icon">🔗</span>
                            Auto-Map Fields
                          </button>
                          <button class="smart-mapping-toolbar-btn secondary">
                            <span class="btn-icon">🧹</span>
                            Clear All
                          </button>
                        </div>
                      </div>
                    </div>
                    <div id="smartMappingFieldsList" class="smart-mapping-fields-list large-list">
                      <!-- Fields will be populated here -->
                    </div>
                    <div id="smartMappingStats" class="smart-mapping-stats">
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Fields Detected</div>
                      </div>
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Mapped</div>
                      </div>
                      <div class="smart-mapping-stat">
                        <div class="smart-mapping-stat-number">0</div>
                        <div class="smart-mapping-stat-label">Need Mapping</div>
                      </div>
                    </div>
                  </div>
                  

                </div>
              </div>
              
              <!-- Modal Footer -->
              <div class="smart-mapping-modal-footer">
                <div id="smartMappingValidation" class="smart-mapping-validation">
                  Ready to configure field mappings
                </div>
                <div class="smart-mapping-actions">
                  <button class="smart-mapping-btn smart-mapping-btn-secondary" onclick="closeSmartFieldMappingModal()">
                    Cancel
                  </button>
                  <button id="smartMappingSaveBtn" class="smart-mapping-btn smart-mapping-btn-primary">
                    Save
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
        gap: 6px;
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
        // Auto-map button
        document
          .getElementById("smartMappingAutoMapBtn")
          ?.addEventListener("click", handleAutoMap);

        // Save button
        document
          .getElementById("smartMappingSaveBtn")
          ?.addEventListener("click", handleSave);

        // Refresh button
        document
          .getElementById("smartMappingRefreshBtn")
          ?.addEventListener("click", handleRefreshFields);





        // Prompt text changes
        document
          .getElementById("smartMappingSystemPrompt")
          ?.addEventListener("input", handlePromptChange);
        document
          .getElementById("smartMappingUserPrompt")
          ?.addEventListener("input", handlePromptChange);

        // Close on overlay click
        document
          .getElementById("smartFieldMappingModal")
          ?.addEventListener("click", function (e) {
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
          modal.classList.remove("active");
          document.body.style.overflow = "auto";
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

        // 🆕 CHECK MAPPING COMPLETENESS: Warn about unmapped fields
        const totalFields = currentFieldSuggestions.length;
        const mappedFields = currentFieldSuggestions.filter(
          (s) => s.mappedField
        ).length;

        if (totalFields > 0 && mappedFields < totalFields) {
          const unmappedFields = currentFieldSuggestions
            .filter((s) => !s.mappedField)
            .map((s) => s.placeholder)
            .join(", ");

          const proceed = confirm(
            `⚠️ Warning: ${
              totalFields - mappedFields
            } fields are not mapped:\n${unmappedFields}\n\nThese placeholders will not be replaced with actual data.\n\nDo you want to save anyway?`
          );

          if (!proceed) {
            return;
          }
        }

        // 🔧 IMPROVED: Use localStorage for session persistence + direct property update
        try {
          const fieldMappingsData = currentFieldSuggestions.map((s) => ({
            placeholder: s.placeholder,
            fieldName: s.fieldName,
            mappedField: s.mappedField || null,
            source: s.source,
            confidence: s.confidence,
            suggestedField: s.suggestedField?.name || null,
            keepAsText: s.keepAsText || false,
            detectionMethod: s.detectionMethod || "traditional"
          }));

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
          handleSaveSuccess(mappedFields, totalFields);

          console.log("✅ Configuration saved to localStorage and memory");

          // Inform user about persistence
          setTimeout(() => {
            const validationDiv = document.getElementById(
              "smartMappingValidation"
            );
            if (validationDiv) {
              validationDiv.innerHTML = `💾 Saved to session! Settings will persist until browser refresh.`;
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
          if (!objectId) return false;

          const savedData = localStorage.getItem(`dynamicLLM_${objectId}`);
          if (!savedData) return false;

          const data = JSON.parse(savedData);

          // Check if data is recent (within 24 hours)
          const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
          if (!isRecent) {
            localStorage.removeItem(`dynamicLLM_${objectId}`);
            return false;
          }

          // Apply saved data to layout
          if (layout && layout.props) {
            layout.props.systemPrompt = data.systemPrompt || "";
            layout.props.userPrompt = data.userPrompt || "";
            layout.props.fieldMappings = data.fieldMappings || [];
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

        // Detect fields in current prompts
        detectAndDisplayFields();

        // Load saved field mappings (prioritize localStorage, then props)
        const savedMappings =
          layout?.props?.fieldMappings || data?.props?.fieldMappings || [];

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

          // Show status if loaded from storage
          if (loadedFromStorage) {
            const validationDiv = document.getElementById(
              "smartMappingValidation"
            );
            if (validationDiv) {
              validationDiv.innerHTML = `📂 Previous session data loaded automatically`;
              validationDiv.style.color = "#2196f3";

              setTimeout(() => {
                updateMappingValidation(); // Restore normal validation status after 3 seconds
              }, 3000);
            }
          }
        }, 100);

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

      // ALSO ADD: Enhanced field replacement that uses saved mappings
      const replaceDynamicFieldsWithMappings = (promptText, layout) => {
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

        // Fallback to original field replacement logic
        return replaceDynamicFields(promptText, layout);
      };

      // Helper function for save success
      function handleSaveSuccess(mappedFields, totalFields) {
        const validationDiv = document.getElementById("smartMappingValidation");
        if (validationDiv) {
          validationDiv.innerHTML = `✅ Configuration saved successfully! ${mappedFields}/${totalFields} fields mapped.`;
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

      function handlePromptChange() {
        // Real-time field detection as user types
        detectAndDisplayFields();
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
          
          // Get the fresh layout from the current object with timeout
          const currentObject = await app.getObject(layout.qInfo.qId);
          const freshLayout = await Promise.race([
            currentObject.getLayout(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          
          // Force refresh the available fields from the updated layout
          const availableFields = getAvailableFields(freshLayout);
          updateAvailableFieldsDisplay(availableFields);
          
          // Only re-detect fields if there are prompts (optimization)
          const systemPrompt =
            document.getElementById("smartMappingSystemPrompt")?.value || "";
          const userPrompt =
            document.getElementById("smartMappingUserPrompt")?.value || "";

          if (systemPrompt.trim() || userPrompt.trim()) {
            // Update field detection with fresh layout
            currentFieldSuggestions = detectPlaceholdersInPrompts(systemPrompt, userPrompt);
            const suggestions = suggestFieldMappings(currentFieldSuggestions, availableFields);
            
            // Update all displays
            updateDetectedFieldsList(suggestions);
            updateFieldStats(currentFieldSuggestions, suggestions);
            updateMappingValidation();
          }
          
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
          
          console.log("✅ Fields refreshed with latest layout");
        } catch (error) {
          console.error("Error refreshing fields:", error);
          
          // Fallback to old method (faster)
          const availableFields = getAvailableFields(layout);
          updateAvailableFieldsDisplay(availableFields);
          
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
            const hasValidation = !!props.enableCustomValidation;
            const hasData = !!(layout.qHyperCube?.qDimensionInfo?.length || layout.qHyperCube?.qMeasureInfo?.length);
            const hasPrompts = !!(props.systemPrompt && props.userPrompt);

            content += `
              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 12px; padding: 24px; min-height: 200px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 8px;">
                  <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.4;">🚀</div>
                  <h3 style="margin: 0 0 6px 0; color: #495057; font-size: 18px; font-weight: 600;">Welcome to Dynamic LLM Extension</h3>
                  <p style="margin: 0; font-size: 14px; color: #6c757d;">Follow these steps to get started with AI-powered data analysis</p>
                </div>

                <!-- Step-by-step setup -->
                <div style="max-width: 500px; margin: 0 auto; width: 100%;">
                  
                  <!-- Step 1: Connection -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${hasConnection ? '#e8f5e8' : '#fff3e0'}; border: 1px solid ${hasConnection ? '#c3e6c3' : '#ffcc80'}; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${hasConnection ? '#28a745' : '#ff9800'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasConnection ? '✓' : '1'}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${hasConnection ? '#155724' : '#e65100'};">
                        ${hasConnection ? 'Connection Configured ✓' : 'Configure Claude Connection'}
                      </div>
                      <div style="font-size: 11px; color: ${hasConnection ? '#155724' : '#e65100'}; opacity: 0.8;">
                        ${hasConnection ? 'Ready to connect to Claude AI' : 'Set connection name in LLM Configuration panel'}
                      </div>
                    </div>
                  </div>

                  <!-- Step 2: Validation -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${hasValidation ? '#e8f5e8' : '#fff3e0'}; border: 1px solid ${hasValidation ? '#c3e6c3' : '#ffcc80'}; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${hasValidation ? '#28a745' : '#ff9800'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasValidation ? '✓' : '2'}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${hasValidation ? '#155724' : '#e65100'};">
                        ${hasValidation ? 'Validation Configured ✓' : 'Setup Selection Validation'}
                      </div>
                      <div style="font-size: 11px; color: ${hasValidation ? '#155724' : '#e65100'}; opacity: 0.8;">
                        ${hasValidation ? 'Custom validation rules are active' : 'Enable validation in Selection Validation panel'}
                      </div>
                    </div>
                  </div>

                  <!-- Step 3: Data -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${hasData ? '#e8f5e8' : '#fff3e0'}; border: 1px solid ${hasData ? '#c3e6c3' : '#ffcc80'}; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${hasData ? '#28a745' : '#ff9800'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasData ? '✓' : '3'}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${hasData ? '#155724' : '#e65100'};">
                        ${hasData ? 'Data Fields Added ✓' : 'Add Dimensions & Measures'}
                      </div>
                      <div style="font-size: 11px; color: ${hasData ? '#155724' : '#e65100'}; opacity: 0.8;">
                        ${hasData ? `${layout.qHyperCube?.qDimensionInfo?.length || 0} dimensions, ${layout.qHyperCube?.qMeasureInfo?.length || 0} measures` : 'Add data fields in the Data panel'}
                      </div>
                    </div>
                  </div>

                  <!-- Step 4: Prompts -->
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: ${hasPrompts ? '#e8f5e8' : '#fff3e0'}; border: 1px solid ${hasPrompts ? '#c3e6c3' : '#ffcc80'}; border-radius: 8px;">
                    <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${hasPrompts ? '#28a745' : '#ff9800'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                      ${hasPrompts ? '✓' : '4'}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; font-size: 13px; color: ${hasPrompts ? '#155724' : '#e65100'};">
                        ${hasPrompts ? 'Prompts Configured ✓' : 'Add AI Prompts'}
                      </div>
                      <div style="font-size: 11px; color: ${hasPrompts ? '#155724' : '#e65100'}; opacity: 0.8;">
                        ${hasPrompts ? 'System and user prompts are ready' : 'Click "Configure Prompts & Field Mapping" to add prompts'}
                      </div>
                    </div>
                  </div>

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
          `;
          document.head.appendChild(style);

          // Generate button handler
          const handleGenerate = async () => {
            const validation = await validateSelections(layout, app);
            const responseDiv = element.querySelector("#llmResponse");
            const generateButton = element.querySelector("#generateButton");

            if (!validation.valid) {
              if (responseDiv) {
                responseDiv.innerHTML = generateValidationErrorHTML(
                  validation,
                  props
                );
              }
              return;
            }

            // Disable button and show loading
            if (generateButton) {
              generateButton.disabled = true;
              generateButton.style.background =
                "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)";
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
              // Get and process prompts
              let systemPrompt = props.systemPrompt || "";
              let userPrompt = props.userPrompt || "";

              // Replace dynamic fields
              systemPrompt = replaceDynamicFieldsEnhanced(systemPrompt, layout);
              userPrompt = replaceDynamicFieldsEnhanced(userPrompt, layout);

              let fullPrompt = userPrompt;
              if (systemPrompt) {
                fullPrompt = systemPrompt + "\n\n" + userPrompt;
              }

              // Add data context if available
              if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
                fullPrompt += "\n\nData Context:\n";
                const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

                // Add headers
                if (
                  layout.qHyperCube.qDimensionInfo?.length ||
                  layout.qHyperCube.qMeasureInfo?.length
                ) {
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

                // Add data rows
                matrix.forEach((row, idx) => {
                  if (idx < 100) {
                    fullPrompt +=
                      row
                        .map((cell) => cell.qText || cell.qNum || "")
                        .join(", ") + "\n";
                  }
                });

                if (matrix.length > 100) {
                  fullPrompt += `... and ${matrix.length - 100} more rows\n`;
                }
              }

              // Escape for JSON
              const escapedPrompt = fullPrompt
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r");

              // Build expression
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

              // Execute
              const response = await app.evaluate({ qExpression: expression });
              const responseText =
                response?.qText || response || "No response received";

              // Display result
              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="word-wrap: break-word; line-height: 1.6; text-align: left; padding: 12px; overflow-y: scroll; height: 220px; scrollbar-width: thin; scrollbar-color: #9ca3af #f1f3f4;" class="analysis-content">
                    <div style="white-space: pre-wrap;">${responseText.replace(
                      /\n/g,
                      "<br>"
                    )}</div>
                  </div>
                `;
              }
            } catch (err) {
              console.error("LLM Error:", err);

              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; color: #dc2626; text-align: left; line-height: 1.5; font-size: 13px; word-wrap: break-word; overflow-wrap: break-word;">
                    <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Error</div>
                    ${err.message || "Failed to generate response"}
                    <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                      Check your connection name and ensure the Claude SSE endpoint is properly configured.
                    </div>
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
                generateButton.innerHTML =
                  '<span style="font-size: 14px;"></span><span>Analysis Complete</span>';
              }
            }
          };

          // Add event listener
          const generateButton = element.querySelector("#generateButton");
          if (generateButton) {
            generateButton.onclick = handleGenerate;
          }

          // NEW: Add modal to the page
          createSmartFieldMappingModal();
        };

        render();
      }, [element, layout, app]); // This will re-run whenever layout changes (including filter selections)
    },
  };
}
