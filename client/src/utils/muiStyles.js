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