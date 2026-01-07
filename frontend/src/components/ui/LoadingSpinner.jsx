export function LoadingSpinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };
  
  return (
    <div className={`${sizes[size]} border-2 border-blue-600 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner size="md" />
    </div>
  );
}

export default LoadingSpinner;
