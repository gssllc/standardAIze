import { useEffect, useMemo, useState } from "react";

import "./App.css";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import VoiceInput from "./components/VoiceToText.jsx";

import {
  TextField as AriaTextField,
  Label,
  TextArea,
} from "react-aria-components/TextField";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import MuiTextField from "@mui/material/TextField";

import {
  buttonStyles,
  dropdownItemStyles,
  getDropdownMenuProps,
  getInputStyles,
} from "./utils/muiStyles.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const EMPTY_CONTEXT = {
  typeModelSeries: "",
  tec: "",
  componentNiin: "",
  componentDescription: "",
  workCenterCode: "",
  actionOrgCode: "",
  serialNumber: "",
};

const EMPTY_CONTEXT_OPTIONS = {
  typeModelSeries: [],
  tecsByTypeModelSeries: {},
  componentsByTypeModelSeriesAndTec: {},
  workCentersByTypeModelSeriesAndTec: {},
  actionOrgsByTypeModelSeriesAndTec: {},
};

function App() {
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [aiNote, setAiNote] = useState("");

  const [maintenanceContext, setMaintenanceContext] =
    useState(EMPTY_CONTEXT);

  const [contextOptions, setContextOptions] = useState(
    EMPTY_CONTEXT_OPTIONS
  );

  const [isLoadingContextOptions, setIsLoadingContextOptions] =
    useState(true);

  const [contextOptionsError, setContextOptionsError] =
    useState("");

  const [isGeneratingAiNote, setIsGeneratingAiNote] =
    useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadMaintenanceContextOptions() {
      try {
        setIsLoadingContextOptions(true);
        setContextOptionsError("");

        const response = await fetch(
          `${API_BASE_URL}/api/maintenance-context-options`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load maintenance context options. HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!isCurrentRequest) {
          return;
        }

        setContextOptions({
          typeModelSeries: Array.isArray(data.typeModelSeries)
            ? data.typeModelSeries
            : [],

          tecsByTypeModelSeries:
            data.tecsByTypeModelSeries || {},

          componentsByTypeModelSeriesAndTec:
            data.componentsByTypeModelSeriesAndTec || {},

          workCentersByTypeModelSeriesAndTec:
            data.workCentersByTypeModelSeriesAndTec || {},

          actionOrgsByTypeModelSeriesAndTec:
            data.actionOrgsByTypeModelSeriesAndTec || {},
        });
      } catch (error) {
        console.error(
          "Failed to load maintenance context options:",
          error
        );

        if (isCurrentRequest) {
          setContextOptionsError(
            "Unable to load maintenance context options."
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoadingContextOptions(false);
        }
      }
    }

    loadMaintenanceContextOptions();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const selectedTypeModelSeries =
    maintenanceContext.typeModelSeries;

  const selectedTec = maintenanceContext.tec;

  const typeModelSeriesTecKey = useMemo(() => {
    if (!selectedTypeModelSeries || !selectedTec) {
      return "";
    }

    return `${selectedTypeModelSeries}||${selectedTec}`;
  }, [selectedTypeModelSeries, selectedTec]);

  const tecOptions =
    contextOptions.tecsByTypeModelSeries[
      selectedTypeModelSeries
    ] || [];

  const componentOptions =
    contextOptions.componentsByTypeModelSeriesAndTec[
      typeModelSeriesTecKey
    ] || [];

  const workCenterOptions =
    contextOptions.workCentersByTypeModelSeriesAndTec[
      typeModelSeriesTecKey
    ] || [];

  const actionOrgOptions =
    contextOptions.actionOrgsByTypeModelSeriesAndTec[
      typeModelSeriesTecKey
    ] || [];

  function handleTranscriptionComplete(transcribedText) {
    setMaintenanceNote((currentNote) => {
      if (!currentNote.trim()) {
        return transcribedText;
      }

      return `${currentNote}\n${transcribedText}`;
    });
  }

  function handleTypeModelSeriesChange(event) {
    const typeModelSeries = event.target.value;

    setMaintenanceContext({
      ...EMPTY_CONTEXT,
      typeModelSeries,
    });
  }

  function handleTecChange(event) {
    const tec = event.target.value;

    setMaintenanceContext((currentContext) => ({
      ...currentContext,
      tec,
      componentNiin: "",
      componentDescription: "",
      workCenterCode: "",
      actionOrgCode: "",
    }));
  }

  function handleComponentChange(event) {
    const componentNiin = event.target.value;

    const selectedComponent = componentOptions.find((component) => {
      const componentValue =
        component.componentNiin || component.value || "";

      return componentValue === componentNiin;
    });

    setMaintenanceContext((currentContext) => ({
      ...currentContext,
      componentNiin,
      componentDescription:
        selectedComponent?.componentDescription ||
        selectedComponent?.label ||
        "",
    }));
  }

  function handleContextTextChange(fieldName, value) {
    setMaintenanceContext((currentContext) => ({
      ...currentContext,
      [fieldName]: value,
    }));
  }

  async function handleGenerateAiNote() {
    const cleanedMaintenanceNote = maintenanceNote.trim();

    if (!cleanedMaintenanceNote) {
      setAiNote("Enter or record a maintenance note first.");
      return;
    }

    const requestBody = {
      rawNote: cleanedMaintenanceNote,
      context: maintenanceContext,
    };

    try {
      setIsGeneratingAiNote(true);
      setAiNote("");

      console.log("Generate AI Note request body:", requestBody);

      const response = await fetch(
        `${API_BASE_URL}/api/generate-ai-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.details ||
            "Failed to generate the AI maintenance note."
        );
      }

      setAiNote(
        data.aiNote ||
          "The AI response did not include a maintenance note."
      );
    } catch (error) {
      console.error("Generate AI Note error:", error);

      setAiNote(
        `Unable to generate AI note: ${error.message}`
      );
    } finally {
      setIsGeneratingAiNote(false);
    }
  }

  return (
    <div className="page">
      <Navbar />

      <main className="maintenance-workspace">
        <Box
          aria-label="Maintenance context"
          sx={{
            width: "min(calc(100% - 48px), 1180px)",
            margin: "0 auto 18px",
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "1.15fr 0.9fr 1.7fr 1fr 1fr 1.15fr",
            },
            gap: "12px",
            alignItems: "center",
          }}
        >
          <MuiTextField
            select
            size="small"
            fullWidth
            label="Type Model Series"
            value={maintenanceContext.typeModelSeries}
            onChange={handleTypeModelSeriesChange}
            disabled={isLoadingContextOptions}
            sx={getInputStyles(maintenanceContext.typeModelSeries)}
            slotProps={{
              select: {
                MenuProps: getDropdownMenuProps(),
              },
            }}
          >
            <MenuItem value="" disabled sx={dropdownItemStyles}>
              Select Model
            </MenuItem>

            {contextOptions.typeModelSeries.map((typeModelSeries) => (
              <MenuItem
                key={typeModelSeries}
                value={typeModelSeries}
                sx={dropdownItemStyles}
              >
                {typeModelSeries}
              </MenuItem>
            ))}
          </MuiTextField>

          <MuiTextField
            select
            size="small"
            fullWidth
            label="TEC"
            value={maintenanceContext.tec}
            onChange={handleTecChange}
            disabled={
              isLoadingContextOptions ||
              !maintenanceContext.typeModelSeries
            }
            sx={getInputStyles(maintenanceContext.tec)}
            slotProps={{
              select: {
                MenuProps: getDropdownMenuProps(),
              },
            }}
          >
            <MenuItem value="" disabled sx={dropdownItemStyles}>
              Select TEC
            </MenuItem>

            {tecOptions.map((tec) => (
              <MenuItem
                key={tec}
                value={tec}
                sx={dropdownItemStyles}
              >
                {tec}
              </MenuItem>
            ))}
          </MuiTextField>

          <MuiTextField
            select
            size="small"
            fullWidth
            label="Component / NIIN"
            value={maintenanceContext.componentNiin}
            onChange={handleComponentChange}
            disabled={
              isLoadingContextOptions ||
              !maintenanceContext.typeModelSeries ||
              !maintenanceContext.tec
            }
            sx={getInputStyles(maintenanceContext.componentNiin)}
            slotProps={{
              select: {
                MenuProps: getDropdownMenuProps(),
              },
            }}
          >
            <MenuItem value="" disabled sx={dropdownItemStyles}>
              Select Component
            </MenuItem>

            {componentOptions.map((component, index) => {
              const componentValue =
                component.componentNiin ||
                component.value ||
                "";

              const componentLabel =
                component.label ||
                component.componentDescription ||
                componentValue;

              return (
                <MenuItem
                  key={`${componentValue}-${index}`}
                  value={componentValue}
                  sx={dropdownItemStyles}
                >
                  {componentLabel}
                  {componentValue ? ` — ${componentValue}` : ""}
                </MenuItem>
              );
            })}
          </MuiTextField>

          <MuiTextField
            select
            size="small"
            fullWidth
            label="Work Center"
            value={maintenanceContext.workCenterCode}
            onChange={(event) => {
              handleContextTextChange(
                "workCenterCode",
                event.target.value
              );
            }}
            disabled={
              isLoadingContextOptions ||
              !maintenanceContext.typeModelSeries ||
              !maintenanceContext.tec
            }
            sx={getInputStyles(maintenanceContext.workCenterCode)}
            slotProps={{
              select: {
                MenuProps: getDropdownMenuProps(),
              },
            }}
          >
            <MenuItem value="" disabled sx={dropdownItemStyles}>
              Select Work Center
            </MenuItem>

            {workCenterOptions.map((workCenterCode) => (
              <MenuItem
                key={workCenterCode}
                value={workCenterCode}
                sx={dropdownItemStyles}
              >
                {workCenterCode}
              </MenuItem>
            ))}
          </MuiTextField>

          <MuiTextField
            select
            size="small"
            fullWidth
            label="Action Org"
            value={maintenanceContext.actionOrgCode}
            onChange={(event) => {
              handleContextTextChange(
                "actionOrgCode",
                event.target.value
              );
            }}
            disabled={
              isLoadingContextOptions ||
              !maintenanceContext.typeModelSeries ||
              !maintenanceContext.tec
            }
            sx={getInputStyles(maintenanceContext.actionOrgCode)}
            slotProps={{
              select: {
                MenuProps: getDropdownMenuProps(),
              },
            }}
          >
            <MenuItem value="" disabled sx={dropdownItemStyles}>
              Select Action Org
            </MenuItem>

            {actionOrgOptions.map((actionOrgCode) => (
              <MenuItem
                key={actionOrgCode}
                value={actionOrgCode}
                sx={dropdownItemStyles}
              >
                {actionOrgCode}
              </MenuItem>
            ))}
          </MuiTextField>

          <MuiTextField
            size="small"
            fullWidth
            label="Serial Number"
            placeholder="Optional"
            value={maintenanceContext.serialNumber}
            onChange={(event) => {
              handleContextTextChange(
                "serialNumber",
                event.target.value
              );
            }}
            sx={getInputStyles(maintenanceContext.serialNumber)}
          />
        </Box>

        <div className="text-field-container">
          <div className="text-field-button-container">
            <AriaTextField>
              <Label>Maintenance Note</Label>

              <div className="maintenance-textarea-wrapper">
                <TextArea
                  className="react-aria-TextArea"
                  placeholder="Enter note here..."
                  value={maintenanceNote}
                  onChange={(event) => {
                    setMaintenanceNote(event.target.value);
                  }}
                />

                <VoiceInput
                  onTranscriptionComplete={
                    handleTranscriptionComplete
                  }
                />
              </div>
            </AriaTextField>

          <Button
            type="button"
            variant="contained"
            sx={{
              ...buttonStyles,
              width: "fit-content",
              minWidth: "unset",
              alignSelf: "flex-start",
            }}
            onClick={handleGenerateAiNote}
            disabled={isGeneratingAiNote}
          >
              {isGeneratingAiNote
                ? "Generating AI Note..."
                : "Generate AI Note"}
            </Button>
          </div>

          <AriaTextField>
            <Label>AI Note</Label>

            <div className="ai-textarea-wrapper">
              <TextArea
                readOnly
                className="react-aria-TextArea"
                placeholder="Waiting for AI response..."
                value={aiNote}
              />
            </div>
          </AriaTextField>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;