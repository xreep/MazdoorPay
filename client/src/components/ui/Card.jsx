export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-card bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
