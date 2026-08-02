import Nav from '../nav';

export default function CadastrosLayout({ children }) {
  return (
    <div className="wrap">
      <Nav />
      {children}
    </div>
  );
}
