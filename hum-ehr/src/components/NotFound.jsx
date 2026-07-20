import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-4">
            <h1 className="display-1 fw-bold text-muted">404</h1>
            <h4 className="mb-2">Page Not Found</h4>
            <p className="text-muted mb-4">The page you're looking for doesn't exist.</p>
            <button className="btn btn-primary" onClick={() => navigate('/patients')}>
                Go to Patient List
            </button>
        </div>
    );
};

export default NotFound;