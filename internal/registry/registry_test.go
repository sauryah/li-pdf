package registry

import (
	"testing"
)

func TestDefaultRegistry_ListAll(t *testing.T) {
	reg := NewDefaultRegistry()
	caps := reg.ListAll()

	if len(caps) == 0 {
		t.Fatal("Expected non-empty capabilities list")
	}

	// Verify crucial operations exist
	expectedOps := []string{
		"pdf_to_jpg",
		"pdf_to_png",
		"pdf_compress",
		"pdf_merge",
		"pdf_split",
		"pdf_rotate",
		"pdf_encrypt",
		"pdf_decrypt",
		"docx_to_pdf",
		"xlsx_to_pdf",
		"jpg_to_pdf",
		"png_to_pdf",
		"image_to_txt",
	}

	for _, op := range expectedOps {
		found, ok := reg.FindOperation(op, "")
		if !ok || found == nil {
			t.Errorf("Expected capability for operation %q to exist", op)
		}
	}
}

func TestDefaultRegistry_FindByMIME(t *testing.T) {
	reg := NewDefaultRegistry()

	pdfCaps := reg.FindByMIME("application/pdf")
	if len(pdfCaps) < 5 {
		t.Errorf("Expected at least 5 PDF capabilities, got %d", len(pdfCaps))
	}

	imageCaps := reg.FindByMIME("image/png")
	if len(imageCaps) < 2 {
		t.Errorf("Expected at least 2 PNG capabilities, got %d", len(imageCaps))
	}

	unknownCaps := reg.FindByMIME("application/unknown-binary")
	if len(unknownCaps) != 0 {
		t.Errorf("Expected 0 capabilities for unknown MIME, got %d", len(unknownCaps))
	}
}
