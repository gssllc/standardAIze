import "./Footer.css";

const GSS_logo = "/GSS_Letters_White.svg";

function Footer() {
    return (
        <nav className="footer">
            <img
                className="GSS-logo"
                src={GSS_logo}
                alt="GSS Logo"
            />
            <p>© 2026 GSS. All rights reserved.</p>
            <p>Version 1.0.0</p>
        </nav>
    );
}

export default Footer;