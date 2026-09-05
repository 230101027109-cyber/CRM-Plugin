import { useState, ChangeEvent, FormEvent } from 'react';

interface FormValues {
  [key: string]: string;
}

interface UseFormReturn<T extends FormValues> {
  values: T;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent) => void;
}

export default function useForm<T extends FormValues>(
  initialValues: T, 
  onSubmit: (values: T) => void
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };
  
  return { values, handleChange, handleSubmit };
}
