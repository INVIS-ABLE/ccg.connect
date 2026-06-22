import { useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PullToRefresh from '@/components/shared/PullToRefresh';

const CATEGORIES = ['before', 'progress', 'completion', 'materials', 'delivery', 'variation', 'defect', 'snagging', 'other'];

export default function ContractorMedia() {
  const [media, setMedia] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedJob, setSelectedJob] = useState('');
  const [category, setCategory] = useState('progress');
  const [caption, setCaption] = useState('');
  const fileRef = useRef();

  const fetchData = useCallback(async () => {
    const [m, j] = await Promise.all([
      base44.entities.JobMedia.list('-created_date', 50),
      base44.entities.Job.filter({ archived: false }),
    ]);
    setMedia(m);
    setJobs(j);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedJob) return;
    setUploading(true);
    const me = await base44.auth.me();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const record = await base44.entities.JobMedia.create({
      job_id: selectedJob,
      uploaded_by: me.id,
      file_url,
      original_filename: file.name,
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      category,
      caption,
      uploaded_at: new Date().toISOString(),
    });
    setMedia(prev => [record, ...prev]);
    setCaption('');
    setUploading(false);
    fileRef.current.value = '';
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="Site Photos" subtitle="Upload and view job media" />

      {/* Upload Section */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Upload Photo</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Job</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Caption (optional)</Label>
            <Input className="mt-1" placeholder="Describe the photo..." value={caption} onChange={e => setCaption(e.target.value)} />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading || !selectedJob} className="w-full gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Take / Upload Photo'}
            </Button>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      <PullToRefresh onRefresh={fetchData}>
      {loading ? (
        <div className="grid grid-cols-3 gap-2">{[...Array(6)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />)}</div>
      ) : media.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <Image className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No photos uploaded yet
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {media.map(m => (
            <a key={m.id} href={m.file_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={m.file_url}
                alt={m.caption || m.category}
                className="aspect-square object-cover rounded-lg w-full"
                onError={e => { e.target.style.display = 'none'; }}
              />
            </a>
          ))}
        </div>
      )}
      </PullToRefresh>
    </div>
  );
}