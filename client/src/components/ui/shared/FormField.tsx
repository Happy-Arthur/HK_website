import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'time' | 'date' | 'textarea' | 'select';
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  options = [],
}) => (
  <div className="space-y-2">
    <Label htmlFor={name}>
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </Label>
    
    {type === 'textarea' ? (
      <Textarea
        id={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? 'border-red-500' : ''}
      />
    ) : type === 'select' ? (
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger className={error ? 'border-red-500' : ''}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={error ? 'border-red-500' : ''}
        step={type === 'number' ? 'any' : undefined}
      />
    )}
    
    {error && <p className="text-sm text-red-500">{error}</p>}
  </div>
);
