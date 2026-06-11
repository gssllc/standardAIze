import "./Navbar.css";

const StandardAIze_logo = "/StandardAIze.svg";

function Navbar() {
    return (
        <nav className="navbar">
        <img
            className="standardAIze-logo"
            src={StandardAIze_logo}
            alt="Standardize AI Logo"
        />
        </nav>
    );
}

export default Navbar;