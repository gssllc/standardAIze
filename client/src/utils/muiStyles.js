export function getInputStyles(value = "") {
    const isFilled = String(value).trim() !== "";

    const defaultBorderColor = "#ffffff";
    const filledBorderColor = "var(--input-filled)";
    const inputBackground = "#101322";

    return {
        "& .MuiOutlinedInput-root": {
        borderRadius: "10px",
        color: "#ffffff",
        backgroundColor: inputBackground,
        transition:
            "border-color 0.2s ease, background-color 0.2s ease",

        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: isFilled
            ? filledBorderColor
            : defaultBorderColor,
            borderWidth: isFilled ? "2px" : "1px",
        },

        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: isFilled
            ? filledBorderColor
            : defaultBorderColor,
            borderWidth: "2px",
        },

        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#ffffff",
            borderWidth: "2px",
        },

        /*
            MUI normally fades disabled outlines.
            Keep them visible so all fields use the same default style.
        */
        "&.Mui-disabled": {
            backgroundColor: inputBackground,
            opacity: 1,
        },

        "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: "#ffffff !important",
            borderWidth: "1px !important",
        },
        },

        "& .MuiInputBase-input": {
        color: "#ffffff",
        fontFamily: "var(--sans)",

        "&::placeholder": {
            color: "#ffffff",
            opacity: 0.78,
        },

        "&.Mui-disabled": {
            color: "rgba(255, 255, 255, 0.7)",
            WebkitTextFillColor: "rgba(255, 255, 255, 0.7)",
        },
        },

        "& .MuiSelect-select": {
        color: "#ffffff",
        fontFamily: "var(--sans)",

        "&.Mui-disabled": {
            color: "rgba(255, 255, 255, 0.7)",
            WebkitTextFillColor: "rgba(255, 255, 255, 0.7)",
        },
        },

        "& .MuiSvgIcon-root": {
        color: isFilled ? filledBorderColor : "#ffffff",
        },

        "& .MuiSvgIcon-root.Mui-disabled": {
        color: "rgba(255, 255, 255, 0.62)",
        },

        "& .MuiInputLabel-root": {
        color: isFilled ? filledBorderColor : "#ffffff",
        fontFamily: "var(--sans)",
        },

        "& .MuiInputLabel-root.Mui-disabled": {
        color: "rgba(255, 255, 255, 0.7)",
        },

        "& .MuiInputLabel-root.Mui-focused": {
        color: "#ffffff",
        },

        "& .MuiInputLabel-root.MuiInputLabel-shrink": {
        color: isFilled ? filledBorderColor : "#ffffff",
        fontSize: "1.1rem",
        fontWeight: 700,
        backgroundColor: inputBackground,
        paddingLeft: "5px",
        paddingRight: "5px",
        borderRadius: "6px",
        },

        "& .MuiInputLabel-root.Mui-focused.MuiInputLabel-shrink": {
        color: "#ffffff",
        },
    };
}

export function getDropdownMenuProps() {
    return {
        disableScrollLock: true,

        slotProps: {
        paper: {
            className: "maintenance-dropdown-menu",
            elevation: 0,
        },
        },
    };
}

export const dropdownItemStyles = {
    color: "#ffffff",
    backgroundColor: "#050914",
    fontFamily: "var(--sans)",
    fontSize: "0.95rem",
    minHeight: "42px",

    "&:hover": {
        backgroundColor: "var(--Signal)",
        color: "#ffffff",
    },

    "&.Mui-selected": {
        backgroundColor: "var(--Signal)",
        color: "#ffffff",
        fontWeight: 700,
    },

    "&.Mui-selected:hover": {
        backgroundColor: "var(--Signal)",
        color: "#ffffff",
    },
};

export const buttonStyles = {
    mt: 2,
    width: "fit-content",
    height: "40px",
    color: "#ffffff",
    backgroundColor: "var(--btn)",
    border: "2px solid transparent",
    borderRadius: "10px",
    textTransform: "none",
    padding: "6px 10px",
    fontSize: "16px",
    fontWeight: 500,
    transform: "scale(1)",
    transition:
        "background 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease, transform 0.45s ease",

    "&:hover": {
        background:
            "linear-gradient(oklch(20.8% 0.042 265.755), oklch(27.9% 0.041 260.031)) padding-box, linear-gradient(90deg, #1d4ed8, #c026d3, #e3fc05, #22c55e) border-box",
        backgroundSize: "100% 100%, 300% 300%",
        backgroundPosition: "center, 0% 50%",
        boxShadow: "var(--btn-hover-shadow)",
        animation:
            "movingGradientBorder 3s linear infinite, voiceBreathing 2.4s ease-in-out infinite",
    },

    "@keyframes movingGradientBorder": {
        "0%": {
            backgroundPosition: "center, 0% 50%",
        },

        "50%": {
            backgroundPosition: "center, 100% 50%",
        },

        "100%": {
            backgroundPosition: "center, 0% 50%",
        },
    },

    "@keyframes voiceBreathing": {
        "0%": {
            transform: "scale(1)",
        },

        "50%": {
            transform: "scale(1.01)",
        },

        "100%": {
            transform: "scale(1)",
        },
    },
};