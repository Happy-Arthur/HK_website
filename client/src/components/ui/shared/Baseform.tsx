import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface BaseFormProps {
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitText?: string;
  cancelText?: string;
  children: React.ReactNode;
}

export const BaseForm: React.FC<BaseFormProps> = ({
  title,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitText = "Save",
  cancelText = "Cancel",
  children,
}) => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <form onSubmit={onSubmit}>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
      <CardFooter className="flex justify-between">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="ml-auto">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitText}
        </Button>
      </CardFooter>
    </form>
  </Card>
);
