import { Construction } from "lucide-react";

interface PlaceholderProps {
  title: string;
  description: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="p-8 h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <h2>{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
