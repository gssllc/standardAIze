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
        {/* <p>© 2026 GSS. All rights reserved.</p> */}
        </nav>
    );
}

export default Footer;