import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from crawler import classify, signature_mime

class ClassifierTests(unittest.TestCase):
    def test_pdf_and_explicit_evidence(self):
        data=b'%PDF-1.4 Toyota 2020 wiring diagram EWD service'
        self.assertEqual(signature_mime(data,'application/pdf'),'application/pdf')
        result=classify('https://licensed.example/docs/toyota-2020.pdf',data,'application/pdf')
        self.assertEqual(result['manufacturer'],'toyota')
        self.assertEqual(result['document_type'],'EWD')
        self.assertEqual(result['year_from'],2020)
    def test_ambiguous_document_needs_review(self):
        result=classify('https://licensed.example/docs/file.pdf',b'%PDF-1.4','application/pdf')
        self.assertTrue(result['needs_admin_review'])
if __name__=='__main__': unittest.main()
